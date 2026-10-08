// Node cannot resolve the `cloudflare:workers` scheme; map it to an empty env.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: "data:text/javascript,export const env = {}; export default { env };",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
