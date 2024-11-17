import Image from 'next/image'
import React from 'react'

export default function PageLoading() {
    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex:'99999', position:'fixed', top: '0', left: '0', backgroundColor: 'white' }}>
            <Image src={'/images/assets/gifs/helmetloadinggif.gif'} width={2000 / 3} height={2000 / 3} style={{ width: '350px', height: 'auto', objectFit: 'cover' }} loop={true} alt={'loading'} />
        </div>
    )
}
