module.exports = (io) => {
  return {
    sendRealTimeUpdate: (userId, data) => {
      io.to(`user_${userId}`).emit('update', data);
    },
    broadcastNotification: (message) => {
      io.emit('notification', { message, timestamp: new Date() });
    }
  };
};