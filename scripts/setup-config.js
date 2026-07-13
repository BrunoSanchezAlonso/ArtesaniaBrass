const fs = require("fs");
const path = require("path");

const configDir = path.join(__dirname, "..", "public", "js", "config");

const files = [
    {
        example: "supabase-config.example.js",
        target: "supabase-config.js",
    },
    {
        example: "stripe-config.example.js",
        target: "stripe-config.js",
    },
];

for (const file of files) {
    const examplePath = path.join(configDir, file.example);
    const targetPath = path.join(configDir, file.target);

    if (fs.existsSync(targetPath)) {
        console.log(`OK  ${file.target} ya existe, no se ha modificado.`);
        continue;
    }

    fs.copyFileSync(examplePath, targetPath);
    console.log(`Creado ${file.target} desde ${file.example}`);
}

console.log("\nRellena las claves en public/js/config/ antes de usar la tienda.");
