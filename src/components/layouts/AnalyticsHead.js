"use client"

import React from 'react'
import FacebookPixel from '../analytics/FacebookPixel'
import GoogleAnalytics from '../analytics/GoogleAnalytics'
import Clarity from '../analytics/Clarity'
import Razorpay from '../analytics/Razorpay'
import { CssBaseline } from '@mui/material'

export default function AnalyticsHead() {
    return (
        <>
            <CssBaseline />
            <FacebookPixel />
            <GoogleAnalytics />
            <Clarity />
            <Razorpay />
        </>
    )
}
