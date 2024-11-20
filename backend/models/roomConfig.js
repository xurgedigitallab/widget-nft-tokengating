import mongoose from 'mongoose';

const roomConfigSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true },
  gatingActive: { type: Boolean, default: false },
  nftIssuerAddress: { type: String, required: true },
  nftTaxonId: { type: Number, required: true },
  minNftCount: { type: Number, required: true }
});

export default mongoose.model('RoomConfig', roomConfigSchema);