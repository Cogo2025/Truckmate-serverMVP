const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.userId });
    res.status(200).json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// If you need driver-specific notifications, add this:
exports.getDriverNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ 
      userId: req.userId,
      // Add any driver-specific filters here
    });
    res.status(200).json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};