const express = require('express');
const { createClient } = require('@libsql/client');

const app = express();

app.use(express.json());
app.use(express.static('public'));

// Cliente Turso (lee env vars)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Inicializar tabla
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS citas (
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
    )
  `);
}
initDb().catch(console.error);

// ---- API ----

app.get('/api/citas', async (req, res) => {
  const { estado } = req.query;
  let sql = 'SELECT * FROM citas';
  const params = [];
  if (estado) {
    sql += ' WHERE estado = ?';
    params.push(estado);
  }
  sql += ' ORDER BY fecha DESC, hora DESC';
  try {
    const result = await db.execute({ sql, args: params });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/citas/proxima', async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM citas WHERE fecha >= ? AND estado = "aprobada" ORDER BY fecha ASC, hora ASC LIMIT 1',
      args: [hoy]
    });
    res.json(result.rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/citas/ocupadas', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT fecha, hora, estado FROM citas WHERE estado IN ("pendiente","aprobada") ORDER BY fecha, hora',
      args: []
    });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/citas', async (req, res) => {
  const { nombre, negocio, telefono, correo, plan, fecha, hora, notas } = req.body;

  if (!nombre || !fecha || !hora) {
    return res.status(400).json({ error: 'Nombre, fecha y hora son obligatorios' });
  }

  try {
    // Verificar si ya existe cita en ese horario (no rechazada)
    const existing = await db.execute({
      sql: 'SELECT * FROM citas WHERE fecha = ? AND hora = ? AND estado != "rechazada"',
      args: [fecha, hora]
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Horario ocupado' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO citas (nombre, negocio, telefono, correo, plan, fecha, hora, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [nombre || '', negocio || '', telefono || '', correo || '', plan || 'basico', fecha, hora, notas || '']
    });
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/citas/:id', async (req, res) => {
  const { estado, nombre, negocio, telefono, correo, plan, fecha, hora, notas } = req.body;
  if (estado && !['aprobada', 'rechazada', 'pendiente'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  try {
    await db.execute({
      sql: `UPDATE citas SET 
        nombre = COALESCE(?, nombre),
        negocio = COALESCE(?, negocio),
        telefono = COALESCE(?, telefono),
        correo = COALESCE(?, correo),
        plan = COALESCE(?, plan),
        fecha = COALESCE(?, fecha),
        hora = COALESCE(?, hora),
        notas = COALESCE(?, notas),
        estado = COALESCE(?, estado)
        WHERE id = ?`,
      args: [nombre, negocio, telefono, correo, plan, fecha, hora, notas, estado, req.params.id]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/citas/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM citas WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Vercel Serverless ----
// Exporta el handler para Vercel
module.exports = app;

// Si se ejecuta directo (local), levanta servidor
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
}