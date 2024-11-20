import { useState, useEffect } from 'react';
import { WidgetApi, WidgetApiToWidgetAction, WidgetApiFromWidgetAction, Capability } from 'matrix-widget-api';
import UserInfo from './components/UserInfo';
import AdminForm from './components/AdminForm';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [widgetApi, setWidgetApi] = useState<WidgetApi | null>(null);

  const setupWidgetApi = async () => {
    try {
      // Create widget API instance
      const widgetId = new URLSearchParams(window.location.search).get('widgetId') || '';
      const api = new WidgetApi(widgetId);

      // Start the registration
      await api.start();

      // Request capabilities
      await api.requestCapabilities([
        "m.capability.requires_client",
        "m.capability.get_openid_connect_token",
      ]);

      // Get access token
      const tokenResponse = await api.requestOpenIDConnectToken();
      if (!tokenResponse?.access_token) {
        throw new Error('Failed to get access token');
      }

      setWidgetApi(api);
      setAccessToken(tokenResponse.access_token);
      await checkAdminStatus(userId, roomId, tokenResponse.access_token);
      
    } catch (error) {
      console.error('Widget API setup failed:', error);
      setIsAdmin(false);
    }
  };

  const checkAdminStatus = async (userId: string, roomId: string, token: string) => {
    try {
      const response = await fetch('/api/check-admin-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, roomId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setIsAdmin(result.isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setRoomId(urlParams.get('roomId') || '');
    setRoomName(urlParams.get('roomName') || '');
    setUserId(urlParams.get('userId') || '');
    setDisplayName(urlParams.get('displayName') || '');

    setupWidgetApi();

    // Cleanup widget API on unmount
    return () => {
      // Add any necessary cleanup code here
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Welcome, {displayName}!</h1>
      <UserInfo
        roomId={roomId}
        roomName={roomName}
        isAdmin={isAdmin}
        onRetry={setupWidgetApi}
      />
      {isAdmin && (
        <AdminForm
          roomId={roomId}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}

export default App;