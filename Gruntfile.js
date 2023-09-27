const path = require('path');
const glob = require('glob');
const saucelabsBrowsers = require(path.resolve('test', 'saucelabs-browsers.ts'));

const sourceFiles = ['Gruntfile.js', 'src/*.ts', 'src/**/*.ts'];

const testFiles = ['Gruntfile.js', 'test/*.ts', 'test/**/*.ts'];

module.exports = exports = function (grunt) {
    'use strict';

    const BANNER =
        '/*!\n' +
        '    localForage -- Offline Storage, Improved\n' +
        '    Version ' +
        grunt.file.readJSON('package.json').version +
        '\n' +
        '    https://localforage.github.io/localForage\n' +
        '    (c) 2013-2017 Mozilla, Apache License 2.0\n' +
        '*/\n';

    const babelModuleIdProvider = function getModuleId(moduleName) {
        const files = {
            'build/localforage': 'localforage',
            'build/utils/serializer': 'localforageSerializer',
            'build/drivers/indexeddb': 'asyncStorage',
            'build/drivers/localstorage': 'localStorageWrapper',
            'build/drivers/websql': 'webSQLStorage'
        };

        return files[moduleName] || moduleName.replace('src/', '');
    };

    grunt.initConfig({
        babel: {
            options: {
                babelrc: false,
                extends: path.resolve('.babelrc-umd'),
                moduleIds: true,
                getModuleId: babelModuleIdProvider
            },
            dist: {
                files: {
                    'build/es5src/localforage.js': 'build/localforage.js',
                    'build/es5src/utils/serializer.js': 'build/utils/serializer.js',
                    'build/es5src/drivers/indexeddb.js': 'build/drivers/indexeddb.js',
                    'build/es5src/drivers/localstorage.js': 'build/drivers/localstorage.js',
                    'build/es5src/drivers/websql.js': 'build/drivers/websql.js'
                }
            }
        },
        browserify: {
            package_bundling_test: {
                src: 'build/test/test/runner.browserify.js',
                dest: 'build/test/localforage.browserify.js',
                options: {
                    alias: {
                        localforage: path.resolve('build/localforage.js')
                    },
                    transform: ['rollupify', 'babelify']
                }
            },
            main: {
                files: {
                    'dist/localforage.js': 'build/localforage.js'
                },
                options: {
                    browserifyOptions: {
                        standalone: 'localforage'
                    },
                    transform: ['rollupify', 'babelify'],
                    plugin: ['bundle-collapser/plugin', 'browserify-derequire']
                }
            },
            no_promises: {
                files: {
                    'dist/localforage.nopromises.js': 'build/localforage.js'
                },
                options: {
                    browserifyOptions: {
                        standalone: 'localforage'
                    },
                    transform: ['rollupify', 'babelify'],
                    plugin: ['bundle-collapser/plugin', 'browserify-derequire'],
                    exclude: ['lie/polyfill']
                }
            }
        },
        concat: {
            options: {
                separator: ''
            },
            localforage: {
                // just to add the BANNER
                // without adding an extra grunt module
                files: {
                    'dist/localforage.js': ['dist/localforage.js'],
                    'dist/localforage.nopromises.js': ['dist/localforage.nopromises.js']
                },
                options: {
                    banner: BANNER
                }
            }
        },
        connect: {
            test: {
                options: {
                    base: path.resolve('build/'),
                    hostname: '*',
                    port: 9999,
                    middleware: function (connect, options, middlewares) {
                        middlewares.unshift(function (req, res, next) {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', '*');
                            return next();
                        });
                        return middlewares;
                    }
                }
            }
        },
        copy: {
            html: {
                expand: true,
                cwd: 'test/',
                src: '*.html',
                dest: 'build/test/',
                filter: 'isFile'
            },
            pics: {
                expand: true,
                cwd: 'test/',
                src: '*.jpg',
                dest: 'build/test/',
                filter: 'isFile'
            },
            test_dist: {
                expand: true,
                cwd: 'dist/',
                src: 'localforage*',
                dest: 'build/dist/',
                filter: 'isFile'
            },
            test_deps: {
                expand: true,
                cwd: 'node_modules/',
                src: ['mocha/mocha.css'],
                dest: 'build/bower_components/',
                filter: 'isFile'
            }
        },
        curl: {
            modernizr: {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/modernizr/2.8.3/modernizr.min.js',
                dest: 'build/bower_components/modernizr/modernizr.js'
            },
            require: {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js',
                dest: 'build/bower_components/requirejs/require.js'
            }
        },
        es3_safe_recast: {
            dist: {
                files: [
                    {
                        src: ['dist/localforage.js'],
                        dest: 'dist/localforage.js'
                    }
                ]
            },
            nopromises: {
                files: [
                    {
                        src: ['dist/localforage.nopromises.js'],
                        dest: 'dist/localforage.nopromises.js'
                    }
                ]
            }
        },
        eslint: {
            target: sourceFiles,
            test: testFiles
        },
        'saucelabs-mocha': {
            all: {
                options: {
                    username: process.env.SAUCE_USERNAME,
                    key: process.env.SAUCE_ACCESS_KEY,
                    urls: ['http://localhost:9999/test/test.main.html'],
                    tunnelTimeout: 5,
                    build: process.env.TRAVIS_JOB_ID,
                    concurrency: 3,
                    browsers: saucelabsBrowsers,
                    testname: 'localForage Tests'
                }
            }
        },
        ts: {
            build: {
                tsconfig: {
                    tsconfig: './tsconfig.json'
                },
                outDir: path.resolve('build/')
            },
            test: {
                tsconfig: {
                    tsconfig: 'test/tsconfig.json'
                },
                outDir: path.resolve('build/test/'),
                options: {
                    baseUrl: path.resolve('build/')
                }
            },
            typing_tests: {
                tsconfig: {
                    tsconfig: 'typing-tests',
                    passThrough: true
                }
            }
        },
        uglify: {
            localforage: {
                files: {
                    'dist/localforage.min.js': ['dist/localforage.js'],
                    'dist/localforage.nopromises.min.js': ['dist/localforage.nopromises.js']
                },
                options: {
                    banner: BANNER
                }
            }
        },
        watch: {
            build: {
                files: ['src/*.ts', 'src/**/*.ts'],
                tasks: ['build', 'eslint:target']
            },
            test: {
                files: ['test/*.ts', 'test/**/*.ts', 'test/*.html'],
                tasks: ['build:test', 'eslint:test']
            },
            dist: {
                files: ['dist/localforage*'],
                tasks: ['copy:test_dist']
            },
            'mocha:unit': {
                files: ['build/dist/localforage.js', 'build/test/*'],
                tasks: ['build:test', 'connect:test', 'mocha:unit']
            }
        },
        webpack: {
            package_bundling_test: {
                entry: './build/test/test/runner.webpack.js',
                output: {
                    path: path.resolve('build/test/'),
                    filename: 'localforage.webpack.js'
                },
                resolve: {
                    alias: {
                        localforage: path.resolve('build/localforage.js')
                    }
                }
            },
            test_deps: {
                mode: 'development',
                entry: {
                    assert: ['./node_modules/assert/assert.js'],
                    chai: ['./node_modules/chai/chai.js'],
                    mocha: ['./node_modules/mocha/mocha.js']
                },
                output: {
                    path: path.resolve('build/bower_components/'),
                    filename: '[name]/[name].js',
                    libraryTarget: 'amd',
                    library: '[name]'
                }
            },
            test: {
                mode: 'development',
                entry: () =>
                    glob.sync('build/test/test/*.js').reduce((acc, file) => {
                        acc[path.basename(file).replace(/\.js$/, '')] = [path.resolve(file)];
                        return acc;
                    }, {}),
                output: {
                    path: path.resolve('build/test/'),
                    filename: '[name].js',
                    libraryTarget: 'amd',
                    library: '[name]'
                },
                externals: {
                    localforage: 'localforage'
                }
            }
        }
    });

    require('load-grunt-tasks')(grunt);

    grunt.registerTask('default', ['build', 'connect', 'watch']);
    grunt.registerTask('build', [
        'ts:build',
        'browserify:main',
        'browserify:no_promises',
        'concat',
        'es3_safe_recast',
        'uglify'
    ]);
    grunt.registerTask('build:test', [
        'ts:test',
        'webpack:test',
        'copy',
        'curl',
        'webpack:test_deps',
        'browserify:package_bundling_test',
        'webpack:package_bundling_test'
    ]);
    grunt.registerTask('serve', ['build', 'connect:test', 'watch']);

    // These are the test tasks we run regardless of Sauce Labs credentials.
    const testTasks = [
        'build',
        'babel',
        'eslint',
        'ts:typing_tests',
        'build:test',
        'connect:test',
        'mocha'
    ];
    grunt.registerTask('test:local', testTasks.slice());
    grunt.registerTask('mocha', 'custom function to run mocha tests', function () {
        const { runner } = require('mocha-headless-chrome');
        const fs = require('fs');
        const done = this.async();
        const tempErrLogs = fs.createWriteStream('temp.test.log');
        const oldStdErr = process.stderr.write;
        const totaltestsPassed = 0;
        const totaltestsFailed = 0;
        const totalDuration = 0;
        const urls = [
            'http://localhost:9999/test/test.main1.html',
            'http://localhost:9999/test/test.min.html',
            'http://localhost:9999/test/test.polyfill.html',
            'http://localhost:9999/test/test.customdriver.html',
            'http://localhost:9999/test/test.faultydriver.html',
            'http://localhost:9999/test/test.nodriver.html',
            'http://localhost:9999/test/test.browserify.html',
            'http://localhost:9999/test/test.callwhenready.html',
            'http://localhost:9999/test/test.require.html',
            'http://localhost:9999/test/test.webpack.html'
        ];

        grunt.util.async.forEachSeries(
            urls,
            async function (url, next) {
                const options = {
                    file: url, // test page path
                    reporter: 'dot', // mocha reporter name
                    width: 800, // viewport width
                    height: 600, // viewport height
                    timeout: 120000, // timeout in ms
                    executablePath: null, // chrome executable path
                    visible: false, // show chrome window
                    args: ['no-sandbox'] // chrome arguments
                };

                console.log('Testing: ' + url + '\n\n');
                process.stderr.write = tempErrLogs.write.bind(tempErrLogs);

                await runner(options)
                    .then((obj) => {
                        process.stderr.write = oldStdErr;
                        if (obj.result.stats.passes) {
                            totaltestsPassed += obj.result.stats.passes;
                            totalDuration += obj.result.stats.duration;
                        }

                        if (obj.result.stats.failures) {
                            totaltestsFailed += obj.result.stats.failures;
                        }
                    })
                    .catch((err) => {
                        process.stderr.write = oldStdErr;
                        console.error(err);
                        process.exit(1);
                    });
                next();
            },
            function () {
                grunt.log.oklns(totaltestsPassed + ' passed! (' + totalDuration / 1000 + 's)');

                if (totaltestsFailed > 0) {
                    grunt.log.errorlns(totaltestsFailed + ' failed!');
                    done(false);
                } else {
                    done(true);
                }
            }
        );
    });

    // Run tests using Sauce Labs if we are on Travis or have locally
    // available Sauce Labs credentials. Use `grunt test:local` to skip
    // Sauce Labs tests.
    // if (process.env.TRAVIS_JOB_ID ||
    //     (process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    //     testTasks.push('saucelabs-mocha');
    // }

    grunt.registerTask('test', testTasks);
};
