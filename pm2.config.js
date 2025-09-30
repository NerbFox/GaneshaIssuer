module.exports = {
  apps: [
    {
      name: "ganeshaissuer",

      script: "npm",

      args: "start",

      exec_mode: "cluster",
      instances: "max",
      
      env_dev: {
        NODE_ENV: "development",
        PORT: 3070,
      },

      env_prod: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};