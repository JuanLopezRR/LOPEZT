const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Pool de conexiones PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Inicializar tabla
async function initDb() {
  try {
    console.log('Attempting to connect to PostgreSQL...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS citas(
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        negocio TEXT DEFAULT '',
        telefono TEXT DEFAULT '',
        correo TEXT DEFAULT '',
        plan TEXT DEFAULT 'basico',
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        notas TEXT DEFAULT '',
        estado TEXT DEFAULT 'pendiente',
        creado TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tabla citas lista');
  } catch (e) {
    console.error('Error init DB:', e.message);
    console.error('Full error:', e);
  }
}
initDb();

// ---- API ----

app.get('/api/citas', async (req, res) => {
  const { estado } = req.query;
  let sql = 'SELECT * FROM citas';
  const params = [];
  if (estado) {
    sql += ' WHERE estado = $1';
    params.push(estado);
  }
  sql += ' ORDER BY fecha DESC, hora DESC';
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/citas/proxima', async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const result = await pool.query(
      'SELECT * FROM citas WHERE fecha >= $1 AND estado = $2 ORDER BY fecha ASC, hora ASC LIMIT 1',
      [hoy, 'aprobada']
    );
    res.json(result.rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/citas/ocupadas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT fecha, hora, estado FROM citas WHERE estado IN ($1, $2) ORDER BY fecha, hora',
      ['pendiente', 'aprobada']
    );
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
    const existing = await pool.query(
      'SELECT * FROM citas WHERE fecha = $1 AND hora = $2 AND estado != $3',
      [fecha, hora, 'rechazada']
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Horario ocupado' });
    }

    const result = await pool.query(
      'INSERT INTO citas (nombre, negocio, telefono, correo, plan, fecha, hora, notas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [nombre || '', negocio || '', telefono || '', correo || '', plan || 'basico', fecha, hora, notas || '']
    );
    res.json({ ok: true, id: result.rows[0].id });
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
    await pool.query(
      `UPDATE citas SET 
        nombre = COALESCE($1, nombre),
        negocio = COALESCE($2, negocio),
        telefono = COALESCE($3, telefono),
        correo = COALESCE($4, correo),
        plan = COALESCE($5, plan),
        fecha = COALESCE($6, fecha),
        hora = COALESCE($7, hora),
        notas = COALESCE($8, notas),
        estado = COALESCE($9, estado)
        WHERE id = $10`,
      [nombre, negocio, telefono, correo, plan, fecha, hora, notas, estado, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/citas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
}