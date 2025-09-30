module.exports = {
  apps: [
    {
      name: "ganeshaissuer",

      script: "npm",

      args: "start",

      exec_mode: "cluster",
      instances: 1,
      
      env_dev: {
        NODE_ENV: "development",
      },

      env_prod: {
        NODE_ENV: "production",
      },
    },
  ],
};