// src/App.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'
import { WidgetApi } from 'matrix-widget-api'
import { AlertCircle, Loader2 } from 'lucide-react'
import { CustomTransport } from './components/CustomTransport'

const CHAT_CLIENT_URL = 'https://app.textrp.io'
const MATRIX_SERVER_URL = 'https://synapse.textrp.io'

export default function App() {
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('')
  const [roomName, setRoomName] = useState<string>('')

  const fetchRoomName = useCallback(async (roomId: string, token: string) => {
    try {
      const response = await fetch(`${MATRIX_SERVER_URL}/_matrix/client/r0/rooms/${roomId}/state/m.room.name`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setRoomName(data.name || 'Unknown Room')
    } catch (err) {
      console.error('Error fetching room name:', err)
      setRoomName('Unknown Room')
    }
  }, [])

  const setupWidgetApi = useCallback(async () => {
    try {
      setIsVerifying(true)
      setError(null)
      setAccessToken(null)

      const urlParams = new URLSearchParams(window.location.search)
      const widgetId = urlParams.get('widgetId') || ''
      const currentUserId = urlParams.get('userId') || ''
      const currentDisplayName = urlParams.get('displayName') || ''
      const currentRoomId = urlParams.get('roomId') || ''

      setUserId(currentUserId)
      setDisplayName(currentDisplayName)
      setRoomId(currentRoomId)

      const api = new WidgetApi(widgetId, CHAT_CLIENT_URL)
      
      const customTransport = new CustomTransport(
        api.transport,
        widgetId,
        api.transport.strictOriginCheck,
        CHAT_CLIENT_URL,
        60
      )

      customTransport.addListener('message', (event: any) => {
        console.log('Transport message received:', event)
      })

      Object.defineProperty(api, 'transport', {
        value: customTransport,
        writable: false,
        configurable: true,
      })

      console.log('Starting WidgetApi registration...')
      await api.start()

      console.log('Requesting m.access_token capability...')
      try {
        await api.requestCapabilities(['m.access_token'])
        console.log('m.access_token capability requested successfully')

        console.log('Waiting for user approval...')
        const hasCapability = await api.hasCapability('m.access_token')
        if (hasCapability) {
          console.log('User approved m.access_token capability')
          const response = await api.requestCapability('m.access_token')
          console.log('Access token response:', response)
          
          if (typeof response === 'string') {
            setAccessToken(response)
            console.log('Access token set successfully')
            fetchRoomName(currentRoomId, response)
          } else {
            throw new Error('Invalid access token response')
          }
        } else {
          throw new Error('User did not approve m.access_token capability')
        }
      } catch (capError) {
        console.error('Error in capability request process:', capError)
        throw new Error('Failed to complete m.access_token capability request process')
      }

    } catch (e: any) {
      console.error('Error setting up WidgetApi:', e)
      setError(e.message || 'An error occurred during setup. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }, [fetchRoomName])

  useEffect(() => {
    setupWidgetApi()
  }, [setupWidgetApi])

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-2">NFT Token Gate Builder</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Welcome, {displayName}!</p>

          <div className="mb-6 text-sm">
            <p><strong>Room ID:</strong> {roomId}</p>
            <p><strong>Room Name:</strong> {roomName}</p>
          </div>

          {isVerifying ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Requesting access token...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 px-4 py-2 rounded-md mb-6">
                  <AlertCircle className="inline-block w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              {accessToken && (
                <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 px-4 py-2 rounded-md mb-6">
                  Access token received successfully!
                </div>
              )}

              <button
                onClick={setupWidgetApi}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Retry Access Token Request
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}