// src/components/WidgetSetup.tsx
import React, { useEffect } from 'react';
import { WidgetApi, MatrixCapabilities } from 'matrix-widget-api';
import * as sdk from "matrix-js-sdk";
import { CustomTransport } from './CustomTransport';

interface WidgetSetupProps {
  setIsAdmin: (isAdmin: boolean) => void;
  setRoomId: (roomId: string) => void;
  setRoomName: (roomName: string) => void;
  setUserId: (userId: string) => void;
  setDisplayName: (displayName: string) => void;
  setError: (error: string | null) => void;
  setIsVerifying: (isVerifying: boolean) => void;
  setAccessToken: (accessToken: string | null) => void;
  setWidgetApi: (widgetApi: WidgetApi | null) => void;
  userId: string;
}

const MATRIX_SERVER_URL = 'https://synapse.textrp.io';
const CHAT_CLIENT_URL = 'https://app.textrp.io';

export const WidgetSetup: React.FC<WidgetSetupProps> = ({
  setIsAdmin,
  setRoomId,
  setRoomName,
  setUserId,
  setDisplayName,
  setError,
  setIsVerifying,
  setAccessToken,
  setWidgetApi,
  userId,
}) => {
  const setupWidgetApi = async () => {
    try {
      setError(null);
      setIsVerifying(true);
      
      const urlParams = new URLSearchParams(window.location.search);
      const widgetId = urlParams.get('widgetId') || '';
      console.log('Setting up widget with ID:', widgetId);

      const api = new WidgetApi(widgetId, CHAT_CLIENT_URL);
      
      const customTransport = new CustomTransport(
        api.transport,
        widgetId,
        api.transport.strictOriginCheck,
        CHAT_CLIENT_URL,
        60
      );
      Object.defineProperty(api, 'transport', {
        value: customTransport,
        writable: false,
        configurable: true,
      });

      console.log('Starting WidgetApi registration...');
      await api.start();

      console.log('Requesting capabilities...');
      await api.requestCapabilities([
        MatrixCapabilities.RequiresClient,
        MatrixCapabilities.MSC2931Navigate,
        'org.matrix.msc3819.send_to_device',
        'm.room.power_levels',
        'm.room.name',
        'm.room.kick',
      ]);

      console.log('Requesting OpenID Connect token...');
      const response = await api.requestOpenIDConnectToken();
      if (!response?.access_token) {
        throw new Error('No access token received');
      }
      setAccessToken(response.access_token);

      setRoomId(decodeURIComponent(urlParams.get('roomId') || ''));
      setRoomName(decodeURIComponent(urlParams.get('roomName') || ''));
      setUserId(decodeURIComponent(urlParams.get('userId') || ''));
      setDisplayName(decodeURIComponent(urlParams.get('displayName') || ''));

      const client = sdk.createClient({
        baseUrl: MATRIX_SERVER_URL,
        accessToken: response.access_token,
        userId: decodeURIComponent(urlParams.get('userId') || ''),
      });

      await checkAdminStatus(decodeURIComponent(urlParams.get('roomId') || ''), client);
      setWidgetApi(api);
    } catch (error) {
      console.error('Widget API setup failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize widget');
      setIsAdmin(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const checkAdminStatus = async (roomId: string, client: sdk.MatrixClient) => {
    if (!roomId || !client) {
      setError('Missing room ID or Matrix client');
      return;
    }

    try {
      const powerLevels = await client.getStateEvent(roomId, 'm.room.power_levels', '');
      const userLevel = powerLevels.users?.[userId] || powerLevels.users_default || 0;
      const adminLevel = powerLevels.state_default || 50;

      setIsAdmin(userLevel >= adminLevel);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setError('Failed to check admin status');
    }
  };

  useEffect(() => {
    setupWidgetApi();
  }, []);

  return null;
};