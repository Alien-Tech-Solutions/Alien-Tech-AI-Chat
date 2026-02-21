module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    // Transform import.meta.env to process.env for Jest compatibility
    function transformImportMeta() {
      return {
        visitor: {
          MetaProperty(path) {
            // Transform import.meta.env.X to process.env.X
            if (
              path.node.meta.name === 'import' &&
              path.node.property.name === 'meta'
            ) {
              const parent = path.parentPath;
              if (
                parent.isMemberExpression() &&
                parent.node.property.name === 'env'
              ) {
                parent.replaceWithSourceString('process.env');
              }
            }
          },
        },
      };
    },
  ],
};
