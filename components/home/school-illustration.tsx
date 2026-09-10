type SchoolIllustrationProps = {
  className?: string;
};

export function SchoolIllustration({ className }: SchoolIllustrationProps) {
  return (
    <svg
      viewBox="0 0 560 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={`h-auto w-full ${className ?? ""}`}
    >
      {/* An open, softly framed campus. */}
      <path
        d="M65 254C65 138 139 46 271 46C399 46 490 132 490 254V371H65V254Z"
        fill="#dce9dc"
      />
      <circle cx="401" cy="91" r="30" fill="#dfa371" />
      <path
        d="M158 91C151 82 137 83 131 93C118 89 107 95 103 105H169C168 97 164 93 158 91Z"
        fill="#fffdf5"
      />
      <path
        d="M318 118C313 111 303 112 299 119C290 116 281 121 279 128H326C325 122 322 119 318 118Z"
        fill="#fffdf5"
      />
      <path
        d="M64 326C135 307 205 317 265 313C369 306 426 300 490 322V371H64V326Z"
        fill="#a8c7ad"
      />
      <path
        d="M283 291C296 327 351 329 355 362C360 391 310 411 284 425H417C443 398 430 374 407 357C361 323 331 322 327 291H283Z"
        fill="#fffdf5"
      />

      {/* School wings and the welcoming central entrance. */}
      <path d="M160 186H270V301H160V186Z" fill="#fffdf5" />
      <path d="M334 174H436V301H334V174Z" fill="#fffdf5" />
      <path d="M150 179H270V191H150V179Z" fill="#20483d" />
      <path d="M333 168H445V180H333V168Z" fill="#20483d" />
      <path d="M251 157L302 123L354 157V301H251V157Z" fill="#fffdf5" />
      <path
        d="M242 164L302 121L364 164"
        stroke="#20483d"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M276 301V254C276 239 287 227 302 227C317 227 329 239 329 254V301H276Z" fill="#20483d" />
      <path d="M302 242V301" stroke="#a8c7ad" strokeWidth="2" />
      <path d="M295 271V278M309 271V278" stroke="#fffdf5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="302" cy="185" r="16" fill="#dce9dc" />
      <path d="M302 176V185L309 189" stroke="#20483d" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="#a8c7ad">
        <path d="M178 207H204V235H178Z" />
        <path d="M219 207H245V235H219Z" />
        <path d="M178 250H204V278H178Z" />
        <path d="M219 250H245V278H219Z" />
        <path d="M363 200H387V230H363Z" />
        <path d="M402 200H426V230H402Z" />
        <path d="M363 247H387V277H363Z" />
        <path d="M402 247H426V277H402Z" />
      </g>
      <g stroke="#fffdf5" strokeWidth="2">
        <path d="M191 207V235M232 207V235M191 250V278M232 250V278" />
        <path d="M375 200V230M414 200V230M375 247V277M414 247V277" />
      </g>
      <path d="M155 301H441" stroke="#20483d" strokeWidth="3" strokeLinecap="round" />
      <path d="M268 304H337V310H268Z" fill="#dfa371" />

      {/* Trees have individually shaped crowns instead of repeating circles. */}
      <path
        d="M110 147C82 145 67 169 73 192C49 215 66 252 91 254C107 278 142 264 146 242C171 226 158 196 146 189C148 165 132 148 110 147Z"
        fill="#20483d"
      />
      <path d="M111 203V321M111 247L91 228M112 231L130 213" stroke="#a8c7ad" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M463 229C439 249 437 279 451 293C459 305 479 308 491 296C507 279 492 246 477 229C473 224 468 224 463 229Z"
        fill="#20483d"
      />
      <path d="M469 263V326M469 291L482 277" stroke="#a8c7ad" strokeWidth="3" strokeLinecap="round" />
      <path d="M71 327C68 311 75 300 82 303C89 305 88 318 88 325C90 307 101 303 104 310C108 318 101 327 101 327" fill="#20483d" />
      <path d="M441 333C439 322 444 316 449 319C453 322 452 328 452 332C455 319 461 319 463 324C465 329 460 334 460 334" fill="#20483d" />

      {/* Three students share the path to school. */}
      <ellipse cx="171" cy="377" rx="32" ry="6" fill="#a8c7ad" />
      <path d="M160 332L155 371M178 332L185 371" stroke="#143c32" strokeWidth="11" strokeLinecap="round" />
      <path d="M155 374H146M185 374H194" stroke="#143c32" strokeWidth="6" strokeLinecap="round" />
      <path d="M152 306C151 294 160 287 170 287C181 287 191 296 189 308L184 339H155L152 306Z" fill="#dfa371" />
      <path d="M152 301L143 327M187 301L199 316L210 305" stroke="#dfa371" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M210 305L213 299" stroke="#20483d" strokeWidth="8" strokeLinecap="round" />
      <path d="M144 327L142 335" stroke="#20483d" strokeWidth="8" strokeLinecap="round" />
      <path d="M170 281V291" stroke="#dfa371" strokeWidth="10" strokeLinecap="round" />
      <circle cx="170" cy="273" r="14" fill="#dfa371" />
      <path d="M155 275C148 262 159 252 172 256C186 256 188 270 182 277L177 267C168 271 161 268 160 268L155 275Z" fill="#143c32" />
      <path d="M158 291C164 299 176 299 182 291" stroke="#fffdf5" strokeWidth="3" strokeLinecap="round" />
      <path d="M180 301V323" stroke="#20483d" strokeWidth="4" strokeLinecap="round" />
      <rect x="181" y="302" width="15" height="28" rx="6" fill="#20483d" />

      <ellipse cx="261" cy="355" rx="25" ry="5" fill="#a8c7ad" />
      <path d="M254 316L247 349M267 316L276 349" stroke="#20483d" strokeWidth="9" strokeLinecap="round" />
      <path d="M247 352H240M276 352H283" stroke="#143c32" strokeWidth="5" strokeLinecap="round" />
      <path d="M246 287C246 278 252 272 261 272C270 272 277 279 276 287L274 321H245L246 287Z" fill="#fffdf5" />
      <path d="M248 282L239 304L229 299M274 283L284 307" stroke="#fffdf5" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M229 299L224 296M284 307L287 313" stroke="#dfa371" strokeWidth="7" strokeLinecap="round" />
      <path d="M261 265V276" stroke="#dfa371" strokeWidth="8" strokeLinecap="round" />
      <circle cx="261" cy="259" r="12" fill="#dfa371" />
      <path d="M249 260C243 248 254 240 264 243C274 243 280 254 272 263L268 252C262 256 255 251 253 252L249 260Z" fill="#20483d" />
      <path d="M251 279L250 309" stroke="#dfa371" strokeWidth="3" strokeLinecap="round" />
      <rect x="239" y="285" width="13" height="25" rx="5" fill="#dfa371" />

      <ellipse cx="382" cy="371" rx="28" ry="6" fill="#a8c7ad" />
      <path d="M372 329L368 365M385 329L394 365" stroke="#143c32" strokeWidth="10" strokeLinecap="round" />
      <path d="M368 368H360M394 368H402" stroke="#143c32" strokeWidth="6" strokeLinecap="round" />
      <path d="M361 304C361 292 369 284 379 284C390 284 397 293 397 304L395 336H363L361 304Z" fill="#20483d" />
      <path d="M363 296L352 317L340 307M394 297L404 323" stroke="#20483d" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M340 307L336 302M404 323L406 330" stroke="#dfa371" strokeWidth="8" strokeLinecap="round" />
      <path d="M379 276V287" stroke="#dfa371" strokeWidth="9" strokeLinecap="round" />
      <circle cx="379" cy="268" r="13" fill="#dfa371" />
      <path d="M365 270C358 260 366 251 372 251C378 245 393 250 394 260C395 265 392 271 390 273L386 262C379 266 371 262 371 262L365 270Z" fill="#143c32" />
      <circle cx="393" cy="257" r="8" fill="#143c32" />
      <path d="M369 290V318" stroke="#a8c7ad" strokeWidth="4" strokeLinecap="round" />
      <rect x="355" y="298" width="17" height="28" rx="6" fill="#a8c7ad" />

      {/* A few small ground marks keep the foreground airy. */}
      <path d="M98 369H118M456 359H471M212 395H225" stroke="#a8c7ad" strokeWidth="3" strokeLinecap="round" />
      <path d="M122 394V383M122 389L116 384M122 389L128 383" stroke="#20483d" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M454 397V386M454 392L448 387M454 392L460 386" stroke="#20483d" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
