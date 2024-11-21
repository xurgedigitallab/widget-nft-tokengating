// src/components/AdminActions.tsx
import React from 'react';
import { WidgetApi } from 'matrix-widget-api';
import * as sdk from "matrix-js-sdk";

interface AdminActionsProps {
  widgetApi: WidgetApi | null;
  isAdmin: boolean;
  accessToken: string | null;
  roomId: string;
  userId: string;
  setError: (error: string | null) => void;
}

const MATRIX_SERVER_URL = 'https://synapse.textrp.io';

export const AdminActions: React.FC<AdminActionsProps> = ({ widgetApi, isAdmin, accessToken, roomId, userId, setError }) => {
  const performAdminAction = async (action: string, data: any) => {
    if (!widgetApi || !isAdmin || !accessToken) {
      setError('Not authorized to perform admin actions');
      return;
    }

    try {
      console.log('Requesting scoped token for action:', action);
      const scopedToken = await widgetApi.requestOpenIDConnectToken();

      if (!scopedToken?.access_token) {
        throw new Error('Failed to obtain scoped token');
      }

      console.log('Obtained scoped token, performing admin action');
      const client = sdk.createClient({
        baseUrl: MATRIX_SERVER_URL,
        accessToken: scopedToken.access_token,
        userId: userId,
      });

      switch (action) {
        case 'm.room.name':
          await client.setRoomName(roomId, data.name);
          break;
        case 'm.room.power_levels':
          await client.setPowerLevel(roomId, data.userId, data.powerLevel);
          break;
        case 'm.room.kick':
          await client.kick(roomId, data.userId, data.reason);
          break;
        default:
          throw new Error('Unsupported admin action');
      }

      console.log(`Admin action ${action} performed successfully`);
    } catch (error) {
      console.error('Error performing admin action:', error);
      setError(`Failed to perform admin action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-2">
      <button 
        onClick={() => performAdminAction('m.room.name', { name: 'New Room Name' })}
        className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-2 px-4 rounded transition-colors"
      >
        Change Room Name
      </button>
      <button 
        onClick={() => performAdminAction('m.room.power_levels', { userId: '@someuser:example.com', powerLevel: 50 })}
        className="w-full bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold py-2 px-4 rounded transition-colors"
      >
        Modify Power Levels
      </button>
      <button 
        onClick={() => performAdminAction('m.room.kick', { userId: '@someuser:example.com', reason: 'Violation of rules' })}
        className="w-full bg-[#F44336] hover:bg-[#E53935] text-white font-bold py-2 px-4 rounded transition-colors"
      >
        Kick Member
      </button>
    </div>
  );
};