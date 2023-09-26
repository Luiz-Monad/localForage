const path = require('path');
const saucelabsBrowsers = require(path.resolve('test', 'saucelabs-browsers.ts'));

const sourceFiles = [
    'Gruntfile.js',
    'src/*.ts',
    'src/**/*.ts',
    'test/**/test.*.ts'
];

module.exports = exports = function(grunt) {
    'use strict';

    const BANNER = 
        '/*!\n' +
        '    localForage -- Offline Storage, Improved\n' +
        '    Version ' + grunt.file.readJSON('package.json').version + '\n' +
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
                src: 'build/test/runner.browserify.js',
                dest: 'build/test/localforage.browserify.js'
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
                    plugin: [
                        'bundle-collapser/plugin', 
                        'browserify-derequire'
                    ]
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
                    plugin: [
                        'bundle-collapser/plugin', 
                        'browserify-derequire'
                    ],
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
                    'dist/localforage.js': [
                        'dist/localforage.js'
                    ],
                    'dist/localforage.nopromises.js': [
                        'dist/localforage.nopromises.js'
                    ]
                },
                options: {
                    banner: BANNER
                }
            }
        },
        connect: {
            test: {
                options: {
                    base: '.',
                    hostname: '*',
                    port: 9999,
                    middleware: function(connect) {
                        return [
                            function(req, res, next) {
                                res.setHeader('Access-Control-Allow-Origin',
                                              '*');
                                res.setHeader('Access-Control-Allow-Methods',
                                              '*');

                                return next();
                            },
                            connect.static(require('path').resolve('.'))
                        ];
                    }
                }
            }
        },
        es3_safe_recast: {
            dist: {
                files: [{
                    src: ['dist/localforage.js'],
                    dest: 'dist/localforage.js'
                }]
            },
            nopromises: {
                files: [{
                    src: ['dist/localforage.nopromises.js'],
                    dest: 'dist/localforage.nopromises.js'
                }]
            }
        },
        eslint: {
            target: sourceFiles
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
                tsconfig: '.'
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
                    'dist/localforage.nopromises.min.js': [
                        'dist/localforage.nopromises.js'
                    ]
                },
                options: {
                    banner: BANNER
                }
            }
        },
        watch: {
            build: {
                files: ['src/*.js', 'src/**/*.js'],
                tasks: ['build']
            },
            'mocha:unit': {
                files: [
                    'dist/localforage.js',
                    'test/runner.js',
                    'test/test.*.*'
                ],
                tasks: [
                    'eslint',
                    'browserify:package_bundling_test',
                    'webpack:package_bundling_test',
                    'mocha:unit'
                ]
            }
        },
        webpack: {
            package_bundling_test: {
                entry: './test/runner.webpack.js',
                output: {
                    path: 'test/',
                    filename: 'localforage.webpack.js'
                }
            }
        }
    });

    require('load-grunt-tasks')(grunt);
    
    grunt.registerTask('default', ['build', 'connect', 'watch']);
    grunt.registerTask('build', ['ts:build', 'browserify:main', 'browserify:no_promises',
        'concat', 'es3_safe_recast', 'uglify']);
    grunt.registerTask('serve', ['build', 'connect:test', 'watch']);

    // These are the test tasks we run regardless of Sauce Labs credentials.
    const testTasks = [
        'build',
        'babel',
        'eslint',
        'ts:typing_tests',
        'browserify:package_bundling_test',
        'webpack:package_bundling_test',
        'connect:test',
        'mocha'
    ];
    grunt.registerTask('test:local', testTasks.slice());
    grunt.registerTask('mocha', 'custom function to run mocha tests', function() {
        const {runner} = require('mocha-headless-chrome');
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

        grunt.util.async.forEachSeries(urls, async function(url, next) {

            const options = {
                file: url,                                   // test page path
                reporter: 'dot',                             // mocha reporter name
                width: 800,                                  // viewport width
                height: 600,                                 // viewport height
                timeout: 120000,                             // timeout in ms
                executablePath: null,                        // chrome executable path
                visible: false,                              // show chrome window
                args: ['no-sandbox']                         // chrome arguments
            };

            console.log('Testing: ' + url + '\n\n');
            process.stderr.write = tempErrLogs.write.bind(tempErrLogs);

            await runner(options)
                .then(obj => {
                    process.stderr.write = oldStdErr;
                    if (obj.result.stats.passes) {
                        totaltestsPassed += obj.result.stats.passes;
                        totalDuration += obj.result.stats.duration;
                    }

                    if (obj.result.stats.failures) {
                        totaltestsFailed += obj.result.stats.failures;
                    }
                })
                .catch(err => {
                    process.stderr.write = oldStdErr;
                    console.error(err);
                    process.exit(1);
            });
            next();
        },function() {

            grunt.log.oklns(totaltestsPassed + ' passed! (' + totalDuration/1000 + 's)');

            if (totaltestsFailed > 0) {
                grunt.log.errorlns(totaltestsFailed + ' failed!');
                done(false);
            } else {
                done(true);
            }
	});
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
