import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const ROLES = [
    "Backend",
    "Frontend",
    "Fullstack",
    "DevOps",
]

export default function extension(pi: ExtensionAPI) {
    pi.registerCommand("onboard-test", {
        description: "This extension provides onboarding functionality for new users.",
        handler: async (args, ctx) => {
            if (!ctx.isIdle()) {
                ctx.ui.notify("Espera a que Pi termine la tarea actual antes de iniciar el onboarding", "warning")
                return;
            }

            let role = args.trim();

            if (!role) {
                const selectedRole = await ctx.ui.select("Selecciona tu rol", ROLES);
                if (!selectedRole) {
                    ctx.ui.notify("No se seleccionó ningún rol. Cancelando onboarding.", "warning")
                    return;
                }
                role = selectedRole;
            }

            ctx.ui.notify("Iniciando onboarding", "info")

            pi.sendUserMessage(
                [
                    "Usa la skill disponible llamada repository-onboarding.",
                    "Lee y sigue sus instrucciones antes de analizar el proyecto.",
                    "",
                    `Rol del desarrollador: ${role}`,
                    "",
                    "Analiza el repositorio actual y genera el onboarding.",
                    "Respalda las afirmaciones con rutas de archivos reales.",
                    "No modifiques archivos ni instales dependencias.",
                ].join("\n"),
            );
        }
    })
}