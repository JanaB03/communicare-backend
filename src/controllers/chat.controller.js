const { Thread, Message } = require('../models/chat.model');
const User = require('../models/user.model');

// @desc    Get all threads for a user
// @route   GET /api/chats/threads
// @access  Private
exports.getThreads = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all threads where user is a participant
    const threads = await Thread.find({ participants: userId })
      .populate('participants', 'name role avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Format response data
    const formattedThreads = threads.map(thread => {
      // Find the other participant
      const otherParticipant = thread.participants.find(
        participant => participant._id.toString() !== userId.toString()
      );

      // Count unread messages
      const unreadCount = thread.messages.filter(
        msg => !msg.isRead && msg.sender.toString() !== userId.toString()
      ).length;

      return {
        id: thread._id,
        participantName: otherParticipant.name,
        participantId: otherParticipant._id,
        participantRole: otherParticipant.role,
        lastMessageTime: thread.lastMessage ? thread.lastMessage.createdAt : thread.updatedAt,
        lastMessage: thread.lastMessage ? thread.lastMessage.content : null,
        unreadCount,
        avatar: otherParticipant.avatar
      };
    });

    res.status(200).json(formattedThreads);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get messages for a specific thread
// @route   GET /api/chats/threads/:threadId/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user._id;

    // Find thread and verify user is a participant
    const thread = await Thread.findOne({
      _id: threadId,
      participants: userId
    }).populate({
      path: 'messages.sender',
      select: 'name role'
    });

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Mark messages as read
    thread.messages.forEach(message => {
      if (message.sender._id.toString() !== userId.toString() && !message.isRead) {
        message.isRead = true;
      }
    });
    await thread.save();

    // Format messages
    const messages = thread.messages.map(message => ({
      id: message._id,
      sender: message.sender._id,
      senderName: message.sender.name,
      senderRole: message.sender.role,
      content: message.content,
      timestamp: message.createdAt,
      isEdited: message.isEdited,
      isRead: message.isRead,
      imageUrl: message.imageUrl,
      location: message.location,
      attachmentType: message.attachmentType,
      documentUrl: message.documentUrl
    }));

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/chats/threads/:threadId/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, attachmentType, attachmentData } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Find thread and verify user is a participant
    let thread = await Thread.findOne({
      _id: threadId,
      participants: userId
    });

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Create new message
    const newMessage = {
      sender: userId,
      content: content.trim(),
      isRead: false
    };

    // Add attachment data if provided
    if (attachmentType === 'image' && attachmentData) {
      newMessage.imageUrl = attachmentData;
      newMessage.attachmentType = 'image';
    } else if (attachmentType === 'location' && attachmentData) {
      newMessage.location = attachmentData;
      newMessage.attachmentType = 'location';
    } else if (attachmentType === 'document' && attachmentData) {
      newMessage.documentUrl = attachmentData;
      newMessage.attachmentType = 'document';
    }

    // Add message to thread
    thread.messages.push(newMessage);
    thread.lastMessage = thread.messages[thread.messages.length - 1]._id;
    await thread.save();

    // Get populated message to return
    thread = await Thread.findById(threadId).populate({
      path: 'messages.sender',
      select: 'name role'
    });

    const sentMessage = thread.messages[thread.messages.length - 1];

    res.status(201).json({
      id: sentMessage._id,
      sender: sentMessage.sender._id,
      senderName: sentMessage.sender.name,
      senderRole: sentMessage.sender.role,
      content: sentMessage.content,
      timestamp: sentMessage.createdAt,
      isEdited: sentMessage.isEdited,
      isRead: sentMessage.isRead,
      imageUrl: sentMessage.imageUrl,
      location: sentMessage.location,
      attachmentType: sentMessage.attachmentType,
      documentUrl: sentMessage.documentUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a new thread
// @route   POST /api/chats/threads
// @access  Private
exports.createThread = async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user._id;

    // Verify participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Check if thread already exists
    const existingThread = await Thread.findOne({
      participants: { $all: [userId, participantId] }
    });

    if (existingThread) {
      return res.status(200).json({ 
        message: 'Thread already exists', 
        threadId: existingThread._id 
      });
    }

    // Create new thread
    const newThread = await Thread.create({
      participants: [userId, participantId]
    });

    res.status(201).json({
      message: 'Thread created successfully',
      threadId: newThread._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Edit a message
// @route   PUT /api/chats/threads/:threadId/messages/:messageId
// @access  Private
exports.editMessage = async (req, res) => {
  try {
    const { threadId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Find thread and message
    const thread = await Thread.findOne({ _id: threadId });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Find message in thread
    const messageIndex = thread.messages.findIndex(
      msg => msg._id.toString() === messageId && msg.sender.toString() === userId.toString()
    );

    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message not found or you are not authorized to edit it' });
    }

    // Update message
    thread.messages[messageIndex].content = content.trim();
    thread.messages[messageIndex].isEdited = true;
    await thread.save();

    res.status(200).json({ message: 'Message updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a message
// @route   DELETE /api/chats/threads/:threadId/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { threadId, messageId } = req.params;
    const userId = req.user._id;

    // Find thread
    const thread = await Thread.findOne({ _id: threadId });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Find message in thread
    const messageIndex = thread.messages.findIndex(
      msg => msg._id.toString() === messageId && msg.sender.toString() === userId.toString()
    );

    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message not found or you are not authorized to delete it' });
    }

    // Remove message
    thread.messages.splice(messageIndex, 1);

    // Update lastMessage if needed
    if (thread.lastMessage && thread.lastMessage.toString() === messageId) {
      thread.lastMessage = thread.messages.length > 0 
        ? thread.messages[thread.messages.length - 1]._id 
        : null;
    }

    await thread.save();

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
