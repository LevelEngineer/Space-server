const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
const rooms = {};
function genCode(){return Math.random().toString(36).substring(2,6).toUpperCase();}
wss.on('connection', (ws)=>{
  ws.room=null; ws.id=Math.random().toString(36).slice(2,9);
  ws.on('message', (data)=>{
    try{
      const msg=JSON.parse(data);
      if(msg.type==='createRoom'){
        let code=genCode(); rooms[code]={players:[], score:0};
        ws.room=code; rooms[code].players.push(ws);
        ws.send(JSON.stringify({type:'joined', code, isHost:true, id:ws.id}));
      }
      if(msg.type==='joinRoom'){
        let code=msg.code.toUpperCase();
        if(!rooms[code]||rooms[code].players.length>=4) return ws.send(JSON.stringify({type:'error', msg:'Sala llena o no existe'}));
        ws.room=code; rooms[code].players.push(ws);
        rooms[code].players.forEach(p=>{ if(p.readyState===1) p.send(JSON.stringify({type:'playerJoined', id:ws.id, count:rooms[code].players.length})); });
        ws.send(JSON.stringify({type:'joined', code, isHost:false, id:ws.id, score:rooms[code].score}));
      }
      if(msg.type==='move'){
        if(!ws.room||!rooms[ws.room]) return;
        rooms[ws.room].players.forEach(p=>{ if(p!==ws&&p.readyState===1) p.send(JSON.stringify({type:'update', id:ws.id, x:msg.x, y:msg.y, a:msg.a})); });
      }
      if(msg.type==='shoot'){
        if(!ws.room||!rooms[ws.room]) return;
        rooms[ws.room].players.forEach(p=>{ if(p!==ws&&p.readyState===1) p.send(JSON.stringify({type:'enemyShoot', id:ws.id, x:msg.x, y:msg.y, a:msg.a})); });
      }
      if(msg.type==='addScore'){
        if(!ws.room||!rooms[ws.room]) return;
        rooms[ws.room].score += msg.amount;
        rooms[ws.room].players.forEach(p=>{ if(p.readyState===1) p.send(JSON.stringify({type:'scoreUpdate', score:rooms[ws.room].score})); });
      }
    }catch(e){console.log(e);}
  });
  ws.on('close', ()=>{
    if(ws.room&&rooms[ws.room]){
      rooms[ws.room].players=rooms[ws.room].players.filter(p=>p!==ws);
      rooms[ws.room].players.forEach(p=>{ if(p.readyState===1) p.send(JSON.stringify({type:'playerLeft', id:ws.id, count:rooms[ws.room].players.length})); });
      if(rooms[ws.room].players.length===0) delete rooms[ws.room];
    }
  });
});
console.log("Servidor corriendo con score compartido");
