import React from 'react';

interface UserInfoProps {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  onRetry: () => void;
}

const UserInfo: React.FC<UserInfoProps> = ({ roomId, roomName, isAdmin, onRetry }) => {
  return (
    <div className="mb-6">
      <p><strong>Room ID:</strong> {roomId}</p>
      <p><strong>Room Name:</strong> {roomName}</p>
      <p className={isAdmin ? "text-green-500" : "text-red-500"}>
        {isAdmin ? "You have admin permissions in this room." : "You do not have admin permissions in this room."}
      </p>
      {!isAdmin && (
        <button
          onClick={onRetry}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Retry Authorization
        </button>
      )}
    </div>
  );
};

export default UserInfo;