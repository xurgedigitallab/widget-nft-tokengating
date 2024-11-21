// backend/routes/api.js
import express from 'express';
import { MatrixClient, SimpleFsStorageProvider } from 'matrix-bot-sdk';
import RoomConfig from '../models/roomConfig.js';
import config from '../config.js';

const router = express.Router();

router.post('/check-admin-status', async (req, res) => {
  const { userId, roomId } = req.body;
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!userId || !roomId || !accessToken) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const client = new MatrixClient(config.homeserverUrl, accessToken, new SimpleFsStorageProvider('./bot.json'));

  try {
    const powerLevelsEvent = await client.getRoomStateEvent(roomId, 'm.room.power_levels', '');
    const userPowerLevel = powerLevelsEvent.users[userId] || powerLevelsEvent.users_default || 0;

    res.json({ isAdmin: userPowerLevel >= 50 });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Error checking admin status' });
  }
});

router.post('/update-config', async (req, res) => {
  const { roomId, gatingActive, nftIssuerAddress, nftTaxonId, minNftCount } = req.body;
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!roomId || gatingActive === undefined || !nftIssuerAddress || 
      nftTaxonId === undefined || minNftCount === undefined || !accessToken) {
    return res.status(400).json({ error: 'Missing required parameters for NFT gating configuration' });
  }

  try {
    await RoomConfig.findOneAndUpdate(
      { roomId },
      { roomId, accessToken, gatingActive, nftIssuerAddress, nftTaxonId, minNftCount },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: `Configuration updated for room ${roomId}` });
  } catch (error) {
    console.error('Error updating room configuration:', error);
    res.status(500).json({ error: 'Error updating room configuration' });
  }
});

export default router;