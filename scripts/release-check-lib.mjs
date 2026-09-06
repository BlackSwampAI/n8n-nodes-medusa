export function supportsNpmTrustedPublishing(version) {
	const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
	if (!match) return false;
	const [, major, minor, patch] = match.map(Number);
	return major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1)));
}

export function githubTagFailure(version, environment = process.env) {
	if (!environment.GITHUB_REF) return undefined;
	const expected = `v${version}`;
	if (environment.GITHUB_REF_TYPE !== 'tag' || environment.GITHUB_REF_NAME !== expected)
		return `GitHub tag must exactly match package version ${expected}`;
	return undefined;
}
