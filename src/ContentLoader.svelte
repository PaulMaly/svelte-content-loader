<svg {width} {height} viewBox="0 0 {width} {height}" version="1.1" ria-labelledby="loading-aria" {preserveAspectRatio}>
	<title id="loading-aria">Loading...</title>
	<rect
		style="fill: url({baseUrl}#{idGradient})"
		clip-path="url({baseUrl}#{idClip})"
		{width} {height}
		x="0" y="0"
	/>
	<defs>
		<clipPath id={idClip}>
			<slot>
				<rect {width} {height} x="0" y="0" rx="5" ry="5"/>
			</slot>
		</clipPath>
		<linearGradient id={idGradient}>
			<stop stop-color={primaryColor} stop-opacity={primaryOpacity} offset="0%">
				{#if animate}
				<animate
					dur="{speed}s"
					values="-2; 1"
					attributeName="offset"
					repeatCount="indefinite"
				/>
				{/if}
			</stop>
			<stop stop-color={secondaryColor} stop-opacity={secondaryOpacity} offset="50%">
				{#if animate}
				<animate
					dur="{speed}s"
					values="-1.5; 1.5"
					attributeName="offset"
					repeatCount="indefinite"
				/>
				{/if}
			</stop>
			<stop stop-color={primaryColor} stop-opacity={primaryOpacity} offset="100%">
				{#if animate}
				<animate
					dur="{speed}s"
					values="-1; 2"
					attributeName="offset"
					repeatCount="indefinite"
				/>
				{/if}
			</stop>
		</linearGradient>
	</defs>
</svg>

<script>
	function uid() {
		return Math.random().toString(36).substring(2);
	}

	export let preserveAspectRatio = 'xMidYMid meet',
		secondaryColor = '#ecebeb',
		primaryColor = '#f9f9f9',
		secondaryOpacity = 1,
		primaryOpacity = 1,
		animate = true,
		baseUrl = '',
		height = 130,
		width = 400,
		speed = 2,
		uniqueKey;

	$: idClip = uniqueKey ? `${uniqueKey}-idClip` : uid();
	$: idGradient = uniqueKey ? `${uniqueKey}-idGradient` : uid();
</script>
