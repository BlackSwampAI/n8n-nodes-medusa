export function isLikelyPropagationFailure(output, packageSpec) {
	const version = packageSpec.slice(packageSpec.lastIndexOf('@') + 1);
	const metadata = /^Reason: No package metadata found for version (\S+)\s*$/m.exec(output);
	return (
		metadata?.[1] === version ||
		/^Reason: Analysis failed: Request failed with status code 404\s*$/m.test(output)
	);
}
export function isDeterministicSecurityFailure(output, packageSpec) {
	if (/ESLint violations found|malware|prohibited dependency/i.test(output)) return true;
	return (
		output.includes(`Package ${packageSpec} has failed security checks`) &&
		!isLikelyPropagationFailure(output, packageSpec)
	);
}
