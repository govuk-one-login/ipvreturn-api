export function checkRequiredEnvVars(requiredVars: string[]): boolean {
	const missingVars = requiredVars.filter(varName => !process.env[varName]);
	if (missingVars.length > 0) {
		return false;
	}
	return true;
}

