const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');

const router = express.Router();
router.use(auth);

async function currentUser(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const accountType = user.accountType || (user.household?.kitchenType === 'hostel' ? 'service' : 'household');
  if (accountType !== 'service' && user.household?.kitchenType !== 'hostel') {
    throw httpError(403, 'Mess polls are available to PG and hostel accounts.');
  }
  return user;
}

function isAdmin(user) {
  // Existing workspace accounts predate the account-level role field; the owner is admin.
  return user.role !== 'member';
}

function publicPoll(poll, userId) {
  if (!poll?.question || !Array.isArray(poll.options)) return null;
  const votes = Array.isArray(poll.votes) ? poll.votes : [];
  const totalVotes = votes.length;
  return {
    question: poll.question,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      votes: votes.filter((vote) => vote.optionId === option.id).length
    })),
    totalVotes,
    myVote: votes.find((vote) => vote.userId === String(userId))?.optionId || null,
    closed: Boolean(poll.closed),
    demo: Boolean(poll.demo),
    updatedAt: poll.updatedAt || null
  };
}

function demoPoll() {
  return {
    question: 'Which special would you like to see on Sunday dinner?',
    options: [
      { id: 'demo-paneer', text: 'Paneer pulao' },
      { id: 'demo-chole', text: 'Chole bhature' },
      { id: 'demo-biryani', text: 'Vegetable biryani' }
    ],
    votes: [],
    closed: false,
    demo: true,
    updatedAt: new Date().toISOString()
  };
}

router.get('/poll', asyncH(async (req, res) => {
  let user = await currentUser(req);
  // Give existing PG accounts a sample poll to explore; an admin can edit or delete it.
  const demoNeedsSundayUpdate = user.messPoll?.demo && user.messPoll.question === 'Which special would you like to see on Friday dinner?';
  if (!user.messPoll?.question || demoNeedsSundayUpdate) {
    const seededPoll = demoPoll();
    if (demoNeedsSundayUpdate) seededPoll.votes = user.messPoll.votes || [];
    user = await req.db.col('users').updateOne({ _id: user._id }, { messPoll: seededPoll }) || { ...user, messPoll: seededPoll };
  }
  res.json({ poll: publicPoll(user.messPoll, user._id), canEdit: isAdmin(user) });
}));

router.put('/poll', asyncH(async (req, res) => {
  const user = await currentUser(req);
  if (!isAdmin(user)) throw httpError(403, 'Only a mess admin can edit this poll.');

  const question = String(req.body?.question || '').trim().slice(0, 180);
  const input = Array.isArray(req.body?.options) ? req.body.options : [];
  const options = input
    .map((option) => ({ id: String(option.id || crypto.randomUUID()), text: String(option.text || '').trim().slice(0, 100) }))
    .filter((option) => option.text)
    .slice(0, 8);
  if (!question) throw httpError(400, 'Enter a poll question.');
  if (options.length < 2) throw httpError(400, 'Add at least two poll options.');
  if (new Set(options.map((option) => option.text.toLocaleLowerCase())).size !== options.length) {
    throw httpError(400, 'Poll options must be unique.');
  }

  const oldPoll = user.messPoll || {};
  const sameOptions = Array.isArray(oldPoll.options)
    && oldPoll.options.length === options.length
    && oldPoll.options.every((oldOption, index) => oldOption.id === options[index].id && oldOption.text === options[index].text);
  const poll = {
    question,
    options,
    // Keep votes when the admin only updates the question; reset if the choices change.
    votes: sameOptions ? (oldPoll.votes || []) : [],
    closed: Boolean(req.body?.closed),
    demo: false,
    updatedAt: new Date().toISOString()
  };
  const updated = await req.db.col('users').updateOne({ _id: user._id }, { messPoll: poll });
  res.json({ poll: publicPoll(updated?.messPoll || poll, user._id), canEdit: true });
}));

router.delete('/poll', asyncH(async (req, res) => {
  const user = await currentUser(req);
  if (!isAdmin(user)) throw httpError(403, 'Only a mess admin can edit this poll.');
  await req.db.col('users').updateOne({ _id: user._id }, { messPoll: null });
  res.json({ poll: null, canEdit: true });
}));

router.post('/poll/vote', asyncH(async (req, res) => {
  const user = await currentUser(req);
  const poll = user.messPoll;
  const optionId = String(req.body?.optionId || '');
  if (!poll?.question) throw httpError(404, 'There is no active mess poll.');
  if (poll.closed) throw httpError(409, 'This poll is closed.');
  if (!poll.options?.some((option) => option.id === optionId)) throw httpError(400, 'Choose a valid poll option.');

  const votes = (poll.votes || []).filter((vote) => vote.userId !== String(user._id));
  votes.push({ userId: String(user._id), optionId });
  const updatedPoll = { ...poll, votes };
  const updated = await req.db.col('users').updateOne({ _id: user._id }, { messPoll: updatedPoll });
  res.json({ poll: publicPoll(updated?.messPoll || updatedPoll, user._id), canEdit: isAdmin(user) });
}));

module.exports = router;
