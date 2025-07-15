"use client"

import React from 'react'
import FacebookPixel from '../analytics/FacebookPixel'
import FacebookClickIdHandler from '../analytics/FacebookClickIdHandler'
import FacebookPageViewTracker from '../analytics/FacebookPageViewTracker'
import GoogleAnalytics from '../analytics/GoogleAnalytics'
import Clarity from '../analytics/Clarity'
import Razorpay from '../analytics/Razorpay'
import { CssBaseline } from '@mui/material'

export default function AnalyticsHead() {
    return (
        <>
            <CssBaseline />
            <FacebookPixel />
            <FacebookClickIdHandler />
            <FacebookPageViewTracker />
            <GoogleAnalytics />
            <Clarity />
            <Razorpay />
        </>
    )
}
