import { MatrixClient, SimpleFsStorageProvider } from 'matrix-bot-sdk';
import xrpl from 'xrpl';
import RoomConfig from '../models/roomConfig.js';
import config from '../config.js';

export async function enforceNftGating() {
  const roomConfigs = await RoomConfig.find({ gatingActive: true });

  for (const roomConfig of roomConfigs) {
    const client = new MatrixClient(config.homeserverUrl, roomConfig.accessToken, new SimpleFsStorageProvider('./bot.json'));
    
    try {
      const members = await client.getJoinedRoomMembers(roomConfig.roomId);

      for (const userId of Object.keys(members)) {
        try {
          const { nfts } = await checkUserXRPLHoldings(userId, roomConfig.nftIssuerAddress, roomConfig.nftTaxonId);
          const nftCount = nfts.length;

          if (nftCount < roomConfig.minNftCount) {
            await client.kickUser(userId, roomConfig.roomId, 'Does not meet NFT holding requirements');
            console.log(`Kicked ${userId} from room ${roomConfig.roomId} for insufficient NFT holdings.`);
          }
        } catch (nftError) {
          console.error(`Error checking NFT holdings for user ${userId}:`, nftError);
        }
      }
    } catch (error) {
      console.error(`Error enforcing NFT gating for room ${roomConfig.roomId}:`, error);
    }
  }
}

async function checkUserXRPLHoldings(userId, nftIssuerAddress, nftTaxonId) {
  const walletAddress = userId.split(':')[0].substring(1);

  const xrplClient = new xrpl.Client(config.xrplServerUrl);
  try {
    await xrplClient.connect();

    const nftHoldings = await xrplClient.request({
      command: 'account_nfts',
      account: walletAddress
    });

    xrplClient.disconnect();

    const filteredNfts = nftHoldings.result.account_nfts.filter(nft => 
      nft.Issuer === nftIssuerAddress && nft.NFTokenTaxon === nftTaxonId
    );

    return { nfts: filteredNfts };
  } catch (error) {
    console.error('Error fetching NFT holdings from XRPL:', error);
    return { nfts: [] };
  }
}