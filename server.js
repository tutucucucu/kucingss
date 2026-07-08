const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// File database path
const DB_PATH = path.join(__dirname, 'db.json');

// Initialize database
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      users: [],
      cats: []
    }, null, 2));
  }
}

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { users: [], cats: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

initDB();

// API Routes
app.get('/api/cats', (req, res) => {
  const db = readDB();
  res.json(db.cats);
});

app.get('/api/cats/:id', (req, res) => {
  const db = readDB();
  const cat = db.cats.find(c => c.id === req.params.id);
  if (!cat) {
    return res.status(404).json({ error: 'Kucing tidak ditemukan' });
  }
  res.json(cat);
});

app.post('/api/cats', (req, res) => {
  const { name, price, breed, age, image, desc, sellerEmail } = req.body;
  
  if (!name || !price || !sellerEmail) {
    return res.status(400).json({ error: 'Nama, harga, dan email penjual wajib diisi' });
  }

  const db = readDB();
  const newCat = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: name.trim(),
    price: Number(price),
    breed: breed || '',
    age: age || '',
    image: image || '',
    desc: desc || '',
    sellerEmail: sellerEmail,
    createdAt: new Date().toISOString()
  };

  db.cats.push(newCat);
  writeDB(db);
  res.status(201).json(newCat);
});

app.put('/api/cats/:id', (req, res) => {
  const { name, price, breed, age, image, desc } = req.body;
  const db = readDB();
  const index = db.cats.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Kucing tidak ditemukan' });
  }

  if (name) db.cats[index].name = name.trim();
  if (price) db.cats[index].price = Number(price);
  if (breed !== undefined) db.cats[index].breed = breed;
  if (age !== undefined) db.cats[index].age = age;
  if (image !== undefined) db.cats[index].image = image;
  if (desc !== undefined) db.cats[index].desc = desc;

  writeDB(db);
  res.json(db.cats[index]);
});

app.delete('/api/cats/:id', (req, res) => {
  const db = readDB();
  const index = db.cats.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Kucing tidak ditemukan' });
  }

  db.cats.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Kucing berhasil dihapus' });
});

// Users
app.get('/api/users', (req, res) => {
  const db = readDB();
  // Remove sensitive data
  const users = db.users.map(u => ({
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    bio: u.bio,
    socialLinks: u.socialLinks || []
  }));
  res.json(users);
});

app.get('/api/users/:email', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.email === req.params.email);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }
  res.json({
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    socialLinks: user.socialLinks || []
  });
});

app.post('/api/users', (req, res) => {
  const { email, name, avatar, bio, socialLinks } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email dan nama wajib diisi' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email === email);

  if (existing) {
    return res.status(400).json({ error: 'Email sudah terdaftar' });
  }

  const newUser = {
    email: email,
    name: name.trim(),
    avatar: avatar || '',
    bio: bio || 'Pecinta kucing',
    socialLinks: socialLinks || []
  };

  db.users.push(newUser);
  writeDB(db);
  res.status(201).json(newUser);
});

app.put('/api/users/:email', (req, res) => {
  const { name, avatar, bio, socialLinks } = req.body;
  const db = readDB();
  const index = db.users.findIndex(u => u.email === req.params.email);

  if (index === -1) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  if (name) db.users[index].name = name.trim();
  if (avatar !== undefined) db.users[index].avatar = avatar;
  if (bio !== undefined) db.users[index].bio = bio;
  if (socialLinks !== undefined) db.users[index].socialLinks = socialLinks;

  writeDB(db);
  res.json({
    email: db.users[index].email,
    name: db.users[index].name,
    avatar: db.users[index].avatar,
    bio: db.users[index].bio,
    socialLinks: db.users[index].socialLinks || []
  });
});

app.get('/api/users/:email/cats', (req, res) => {
  const db = readDB();
  const cats = db.cats.filter(c => c.sellerEmail === req.params.email);
  res.json(cats);
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
