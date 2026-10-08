const express = require('express');
const app = express();

const storage = require('../config/storage');
const mikrotik = require('../config/mikrotik');

app.use(express.json());

// 1. ENDPOINT REGISTER (Menyimpan user baru ke Upstash Redis sebagai 'pending')
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, phone, username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
        }

        // Cek apakah username sudah ada
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar' });
        }

        const newUser = await storage.addUser({ name, email, phone, username, password });
        res.json({ success: true, message: 'Registrasi berhasil, menunggu approval admin', user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. ENDPOINT LOGIN (Mengecek status approved & kecocokan password)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await storage.getUserByUsername(username);

        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Username atau password salah' });
        }

        if (user.status !== 'approved') {
            return res.status(403).json({ success: false, message: 'User not approved yet' });
        }

        res.json({ success: true, message: 'Login berhasil', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. ENDPOINT GET USERS + TRAFFIC MIKROTIK (Untuk Admin Panel)
app.get('/api/users', async (req, res) => {
    try {
        const users = await storage.getAllUsers();[cite: 10]
        const mtStats = await mikrotik.getUsersStats();

        const responseUsers = users.map(user => {
            const mtUser = mtStats.find(u => u.name && u.name.toLowerCase() === user.username.toLowerCase());
            return {
                ...user,
                'bytes-in': mtUser ? mtUser['bytes-in'] : 0,
                'bytes-out': mtUser ? mtUser['bytes-out'] : 0,
                uptime: mtUser ? mtUser.uptime : 'Off'
            };
        });

        res.json({ success: true, users: responseUsers });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data user' });
    }
});

// 4. ENDPOINT APPROVE (Ubah status di Redis & daftarkan user ke MikroTik Hotspot)
app.post('/api/approve', async (req, res) => {
    try {
        const { username, adminName = 'Admin' } = req.body;
        const updatedUser = await storage.approveUser(username, adminName);[cite: 10]

        // Tambahkan juga secara otomatis ke MikroTik Hotspot
        await mikrotik.addUserToHotspot(updatedUser.username, updatedUser.password, 'default');

        res.json({ success: true, message: `User ${username} berhasil diapprove`, user: updatedUser });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. ENDPOINT REJECT
app.post('/api/reject', async (req, res) => {
    try {
        const { username, adminName = 'Admin' } = req.body;
        const updatedUser = await storage.rejectUser(username, adminName);[cite: 10]
        res.json({ success: true, message: `User ${username} berhasil direject`, user: updatedUser });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. ENDPOINT DELETE (Hapus dari Redis & MikroTik)
app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        await storage.deleteUser(username);[cite: 10]
        await mikrotik.removeUserFromHotspot(username);

        res.json({ success: true, message: `User ${username} berhasil dihapus` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = app;
