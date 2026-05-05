import confetti from 'canvas-confetti';

export function fireSuccessConfetti(): void {
	if (typeof window === 'undefined') return;
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

	const duration = 700;
	const end = Date.now() + duration;

	const burst = () => {
		confetti({
			particleCount: 60,
			spread: 70,
			startVelocity: 35,
			origin: { y: 0.7 },
			disableForReducedMotion: true
		});
	};

	burst();
	const interval = window.setInterval(() => {
		if (Date.now() > end) {
			window.clearInterval(interval);
			return;
		}
		confetti({
			particleCount: 25,
			angle: 60 + Math.random() * 60,
			spread: 55,
			origin: { x: Math.random(), y: 0.6 },
			disableForReducedMotion: true
		});
	}, 200);
}
