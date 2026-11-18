const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });

// Lưu trữ room: { roomId: { A: ws, B: ws } }
const rooms = {};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'join') {
        if (!rooms[data.room]) rooms[data.room] = {};
        const role = rooms[data.room].A ? 'B' : 'A'; // Người vào đầu là A, sau là B
        rooms[data.room][role] = ws;
        ws.roomId = data.room;
        ws.role = role;
        
        ws.send(JSON.stringify({ type: 'joined', role }));
        
        // Nếu đủ 2 người, thông báo cho cả 2
        if (rooms[data.room].A && rooms[data.room].B) {
          rooms[data.room].A.send(JSON.stringify({ type: 'ready' }));
          rooms[data.room].B.send(JSON.stringify({ type: 'ready' }));
        }
      }
      
      if (data.type === 'msg') {
        // Chuyển tiếp tin nhắn cho người còn lại trong phòng
        const room = rooms[data.room];
        if (room) {
          const target = ws.role === 'A' ? room.B : room.A;
          if (target && target.readyState === 1) {
            target.send(JSON.stringify(data));
          }
        }
      }
    } catch (e) { console.error(e); }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms[ws.roomId]) {
      delete rooms[ws.roomId][ws.role];
      const other = ws.role === 'A' ? rooms[ws.roomId].B : rooms[ws.roomId].A;
      if (other && other.readyState === 1) {
        other.send(JSON.stringify({ type: 'peer_left' }));
      }
    }
  });
});
console.log('Relay Server chạy ở port 8080');