const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('agenda.db');

db.run(`CREATE TABLE IF NOT EXISTS citas(
id INTEGER PRIMARY KEY AUTOINCREMENT,
nombre TEXT NOT NULL,
negocio TEXT DEFAULT '',
telefono TEXT DEFAULT '',
correo TEXT DEFAULT '',
plan TEXT DEFAULT 'basico',
fecha TEXT NOT NULL,
hora TEXT NOT NULL,
notas TEXT DEFAULT '',
estado TEXT DEFAULT 'pendiente',
creado TEXT DEFAULT (datetime('now','localtime'))
)`);

db.all("PRAGMA table_info(citas)",[],(e,cols)=>{
 if(!e && cols){
   const names=cols.map(c=>c.name);
   const addIfMissing=(name,def)=>{
     if(!names.includes(name)){
       db.run(`ALTER TABLE citas ADD COLUMN ${name} ${def}`);
     }
   };
   addIfMissing("negocio","TEXT DEFAULT ''");
   addIfMissing("telefono","TEXT DEFAULT ''");
   addIfMissing("correo","TEXT DEFAULT ''");
   addIfMissing("plan","TEXT DEFAULT 'basico'");
   addIfMissing("notas","TEXT DEFAULT ''");
   addIfMissing("creado","TEXT DEFAULT (datetime('now','localtime'))");
 }
});

app.get('/api/citas',(req,res)=>{
 const {estado}=req.query;
 let sql='SELECT * FROM citas';
 let params=[];
 if(estado){
   sql+=' WHERE estado=?';
   params.push(estado);
 }
 sql+=' ORDER BY fecha DESC, hora DESC';
 db.all(sql,params,(e,r)=>{
   if(e) return res.status(500).json({error:e.message});
   res.json(r);
 });
});

app.get('/api/citas/proxima',(req,res)=>{
 const hoy=new Date().toISOString().slice(0,10);
 db.get(
   'SELECT * FROM citas WHERE fecha>=? AND estado="aprobada" ORDER BY fecha ASC, hora ASC LIMIT 1',
   [hoy],
   (e,row)=>res.json(row||null)
 );
});

app.get('/api/citas/ocupadas',(req,res)=>{
 db.all(
   'SELECT fecha,hora,estado FROM citas WHERE estado IN ("pendiente","aprobada") ORDER BY fecha,hora',
   [],
   (e,r)=>{
     if(e) return res.status(500).json({error:e.message});
     res.json(r);
   }
 );
});

app.post('/api/citas',(req,res)=>{
 const {nombre,negocio,telefono,correo,plan,fecha,hora,notas}=req.body;

 if(!nombre||!fecha||!hora){
   return res.status(400).json({error:'Nombre, fecha y hora son obligatorios'});
 }

 db.get(
   'SELECT * FROM citas WHERE fecha=? AND hora=? AND estado!="rechazada"',
   [fecha,hora],
   (e,row)=>{
     if(row) return res.status(400).json({error:'Horario ocupado'});

     db.run(
       'INSERT INTO citas(nombre,negocio,telefono,correo,plan,fecha,hora,notas) VALUES(?,?,?,?,?,?,?,?)',
       [nombre||'',negocio||'',telefono||'',correo||'',plan||'basico',fecha,hora,notas||''],
       function(){
         res.json({ok:true,id:this.lastID});
       }
     );
   }
 );
});

app.put('/api/citas/:id',(req,res)=>{
 const {estado,nombre,negocio,telefono,correo,plan,fecha,hora,notas}=req.body;
 if(estado && !['aprobada','rechazada','pendiente'].includes(estado)){
   return res.status(400).json({error:'Estado no válido'});
 }
 db.run(
   `UPDATE citas SET 
     nombre=COALESCE(?,nombre),
     negocio=COALESCE(?,negocio),
     telefono=COALESCE(?,telefono),
     correo=COALESCE(?,correo),
     plan=COALESCE(?,plan),
     fecha=COALESCE(?,fecha),
     hora=COALESCE(?,hora),
     notas=COALESCE(?,notas),
     estado=COALESCE(?,estado)
     WHERE id=?`,
   [nombre,negocio,telefono,correo,plan,fecha,hora,notas,estado,req.params.id],
   function(){
     if(this.changes===0) return res.status(404).json({error:'Cita no encontrada'});
     res.json({ok:true});
   }
 );
});

app.delete('/api/citas/:id',(req,res)=>{
 db.run('DELETE FROM citas WHERE id=?',
   [req.params.id],
   function(){
     if(this.changes===0) return res.status(404).json({error:'Cita no encontrada'});
     res.json({ok:true});
   }
 );
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
}