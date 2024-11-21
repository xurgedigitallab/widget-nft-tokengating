// src/components/RoomInfo.tsx
import React from 'react';

interface RoomInfoProps {
  roomId: string;
  roomName: string;
}

export const RoomInfo: React.FC<RoomInfoProps> = ({ roomId, roomName }) => {
  return (
    <div className="space-y-2">
      <p>
        <span className="font-bold">Room ID:</span> {roomId || 'Unknown'}
      </p>
      <p>
        <span className="font-bold">Room Name:</span> {roomName || 'Unknown'}
      </p>
    </div>
  );
};