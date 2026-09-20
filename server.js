const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

let rooms = {};

function makeCode(){ return Math.random().toString(36).substring(2,6).toUpperCase(); }

function broadcast(roomCode, data, exceptId=null){
  let room = rooms[roomCode];
  if(!room) return;
  let str = JSON.stringify(data);
  for(let [id, client] of room.players){
    if(id!==exceptId && client.readyState===1) client.send(str);
  }
}

wss.on('connection', ws=>{
  let myId = Math.random().toString(36).substring(2,9);
  let myRoom = null;
  ws.id = myId;

  ws.on('message', raw=>{
    try{
      let msg = JSON.parse(raw);
      if(msg.type==='createRoom'){
        let code = makeCode();
        rooms[code] = { hostId: myId, players: new Map(), score: 0 };
        rooms[code].players.set(myId, ws);
        myRoom = code;
        ws.send(JSON.stringify({ type:'joined', code, id:myId, isHost:true, score:0 }));
      }
      if(msg.type==='joinRoom'){
        let code = msg.code.toUpperCase();
        let room = rooms[code];
        if(!room) return ws.send(JSON.stringify({type:'error', msg:'Sala no existe'}));
        room.players.set(myId, ws);
        myRoom = code;
        ws.send(JSON.stringify({ type:'joined', code, id:myId, isHost:false, score:room.score }));
        broadcast(code, { type:'playerJoined', count: room.players.size });
      }
      if(msg.type==='move'){
        if(!myRoom) return;
        broadcast(myRoom, { type:'update', id:myId, x:msg.x, y:msg.y, a:msg.a, life:msg.life }, myId);
      }
      if(msg.type==='addScore'){
        if(!myRoom ||!rooms[myRoom]) return;
        rooms[myRoom].score += msg.amount;
        broadcast(myRoom, { type:'scoreUpdate', score: rooms[myRoom].score });
      }
      if(msg.type==='syncWorld'){
        if(!myRoom ||!rooms[myRoom]) return;
        if(rooms[myRoom].hostId!==myId) return;
        broadcast(myRoom, msg, myId);
      }
    }catch(e){}
  });

  ws.on('close', ()=>{
    if(myRoom && rooms[myRoom]){
      rooms[myRoom].players.delete(myId);
      if(rooms[myRoom].players.size===0) delete rooms[myRoom];
      else {
        if(rooms[myRoom].hostId===myId){
          let newHostId = rooms[myRoom].players.keys().next().value;
          rooms[myRoom].hostId = newHostId;
          let newHostWs = rooms[myRoom].players.get(newHostId);
          if(newHostWs) newHostWs.send(JSON.stringify({type:'nowHost'}));
        }
        broadcast(myRoom, { type:'playerLeft', id:myId });
      }
    }
  });
});
console.log('Server running');
