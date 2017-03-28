module.exports = {
    "extends": "airbnb-base",
    "plugins": [
        "import"
    ],
    "env": {
        "node": true,
        "mocha": true,
        "es6": true,
    },
    "rules": {
        "no-underscore-dangle": [0],
        "class-method-use-this": [0],
        "arrow-body-style": [1],
    }
};