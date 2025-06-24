const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Task = require('../models/Task');

router.get('/', adminAuth, async (req, res) => {
  try {
    const tasks = await Task.find().lean();
    res.json(
      tasks.map((task) => ({
        _id: task._id.toString(),
        title: task.title,
        link: task.link,
        completions: task.completions.length,
        status: task.status,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, link, status } = req.body;
    if (!title || !link || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const task = new Task({ title, link, status, reward: 300 });
    await task.save();
    res.status(201).json({
      _id: task._id.toString(),
      title: task.title,
      link: task.link,
      completions: task.completions.length,
      status: task.status,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/archive', adminAuth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task archived' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/unarchive', adminAuth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task unarchived' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;