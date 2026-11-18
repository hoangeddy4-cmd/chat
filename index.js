const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Lưu trữ room: { roomId: Set([ws1, ws2, ws3...]) }
const rooms = {};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'join') {
        if (!rooms[data.room]) rooms[data.room] = new Set();
        
        // Nếu phòng đã có >= 10 người thì chặn
        if (rooms[data.room].size >= 10) {
          ws.send(JSON.stringify({ type: 'error', msg: 'Phòng đã đầy (tối đa 10 người).' }));
          return;
        }

        rooms[data.room].add(ws);
        ws.roomId = data.room;

        // Báo cho người mới vào biết danh sách những người đã có mặt
        const existingUsers = Array.from(rooms[data.room]).filter(client => client !== ws).length;
        ws.send(JSON.stringify({ type: 'joined', usersCount: existingUsers }));

        // Báo cho cả phòng biết có người mới (gửi kèm số lượng)
        broadcast(data.room, { 
          type: 'system', 
          msg: `Có người mới vào phòng. Hiện tại có ${rooms[data.room].size} người.` 
        });

        // Yêu cầu tất cả mọi người gửi lại Public Key để người mới có thể kết nối E2E
        broadcast(data.room, { type: 'request_pubkey' });
      }

      if (data.type === 'msg' || data.type === 'pubkey') {
        // Chuyển tiếp tin nhắn cho tất cả MỌI NGƯỜI trong phòng (trừ người gửi)
        const room = rooms[ws.roomId];
        if (room) {
          for (const client of room) {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify(data));
            }
          }
        }
      }
    } catch (e) { console.error('Lỗi parse JSON:', e); }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms[ws.roomId]) {
      rooms[ws.roomId].delete(ws);
      
      if (rooms[ws.roomId].size === 0) {
        delete rooms[ws.roomId];
      } else {
        broadcast(ws.roomId, { 
          type: 'system', 
          msg: `Có người rời phòng. Còn lại ${rooms[ws.roomId].size} người.` 
        });
      }
    }
  });
});

function broadcast(roomId, payload) {
  const room = rooms[roomId];
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === 1) client.send(msg);
  }
}

console.log(`Relay Server chạy ở port ${PORT}`);