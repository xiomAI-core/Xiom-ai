'use client'

import { useState, useMemo } from 'react'

import CodeBlock from '@/components/ui/CodeBlock'

import { installScriptUrl } from '@/lib/urls'



const PROVIDERS = [

  { id: 'codex', name: 'Codex' },

  { id: 'claude-code', name: 'Claude Code', installId: 'claude' },

  { id: 'gemini', name: 'Gemini' },

] as const



type ProviderId = (typeof PROVIDERS)[number]['id']



function providerInstallId(provider: (typeof PROVIDERS)[number]): string {

  return 'installId' in provider && provider.installId

    ? provider.installId

    : provider.id

}



export default function BootstrapSelector() {

  const [selected, setSelected] = useState<ProviderId>('codex')

  const provider = PROVIDERS.find((p) => p.id === selected) ?? PROVIDERS[0]



  const command = useMemo(

    () => `curl -fsSL ${installScriptUrl(providerInstallId(provider))} | bash`,

    [provider]

  )



  return (

    <div className="w-full">

      {/* Provider tabs */}

      <div className="flex gap-2 mb-4">

        {PROVIDERS.map((p) => (

          <button

            key={p.id}

            onClick={() => setSelected(p.id)}

            className={[

              'px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-all',

              selected === p.id

                ? 'bg-white text-black border-white'

                : 'bg-transparent text-white/45 border-white/10 hover:border-white/30 hover:text-white',

            ].join(' ')}

          >

            {p.name}

          </button>

        ))}

      </div>



      {/* Bootstrap command */}

      <CodeBlock

        code={command}

        language="bash"

        label={`Bootstrap · ${provider.name}`}

      />

    </div>

  )

}

