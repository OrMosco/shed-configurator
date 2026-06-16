import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import ShedConfigurator from './ShedConfigurator'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShedConfigurator />
    <Analytics />
  </React.StrictMode>
)
