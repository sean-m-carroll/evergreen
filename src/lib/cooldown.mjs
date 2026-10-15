export default ({ config, name }) => {
  const rules = config.ignoreCooldown || [];
  let cooldown = config.cooldown;

  rules.forEach((rule) => {
    const regex = new RegExp(rule);

    if (name.match(regex)) {
      cooldown = 0;
    }
  });

  return cooldown;
};
