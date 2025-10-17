"use client"

import React, { Suspense } from 'react'
import FacebookPixel from '../analytics/FacebookPixel'
import FacebookClickIdHandler from '../analytics/FacebookClickIdHandler'
import FacebookPageViewTracker from '../analytics/FacebookPageViewTracker'
import GoogleAnalyticsGA4 from '../analytics/GoogleAnalyticsGA4'
import GoogleTagManager from '../analytics/GoogleTagManager'
import Clarity from '../analytics/Clarity'
import Razorpay from '../analytics/Razorpay'
import { CssBaseline } from '@mui/material'

export default function AnalyticsHead() {
    return (
        <>
            <CssBaseline />
            <GoogleTagManager />
            <FacebookPixel />
            <FacebookClickIdHandler />
            <Suspense fallback={null}>
                <FacebookPageViewTracker />
            </Suspense>
            <GoogleAnalyticsGA4 />
            <Clarity />
            <Razorpay />
        </>
    )
}
