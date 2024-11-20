import React, { useState } from 'react';

interface AdminFormProps {
  roomId: string;
  accessToken: string;
}

const AdminForm: React.FC<AdminFormProps> = ({ roomId, accessToken }) => {
  const [gatingActive, setGatingActive] = useState(false);
  const [nftIssuerAddress, setNftIssuerAddress] = useState('');
  const [nftTaxonId, setNftTaxonId] = useState('');
  const [minNftCount, setMinNftCount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          roomId,
          gatingActive,
          nftIssuerAddress,
          nftTaxonId: parseInt(nftTaxonId),
          minNftCount: parseInt(minNftCount)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      alert('Configuration updated successfully!');
    } catch (error) {
      console.error('Error submitting configuration:', error);
      alert(`An error occurred while submitting the configuration: ${error}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">NFT Token Gating Configuration</h2>
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={gatingActive}
            onChange={(e) => setGatingActive(e.target.checked)}
            className="mr-2"
          />
          Enable Gating
        </label>
      </div>
      <div>
        <label htmlFor="nftIssuerAddress" className="block mb-2">NFT Issuer Address:</label>
        <input
          type="text"
          id="nftIssuerAddress"
          value={nftIssuerAddress}
          onChange={(e) => setNftIssuerAddress(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="nftTaxonId" className="block mb-2">NFT Taxon ID:</label>
        <input
          type="number"
          id="nftTaxonId"
          value={nftTaxonId}
          onChange={(e) => setNftTaxonId(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="minNftCount" className="block mb-2">Minimum NFT Count for Membership:</label>
        <input
          type="number"
          id="minNftCount"
          value={minNftCount}
          onChange={(e) => setMinNftCount(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        Submit Configuration
      </button>
    </form>
  );
};

export default AdminForm;