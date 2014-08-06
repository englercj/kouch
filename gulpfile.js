var gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    cover = require('gulp-coverage'),
    jshint = require('gulp-jshint');

/*****
 * JSHint task, lints the lib and test *.js files.
 *****/
gulp.task('jshint', function () {
    return gulp.src(['./lib/**/*.js', './test/**/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

/*****
 * Test task, runs mocha against unit test files.
 *****/
gulp.task('test', function () {
    return gulp.src('./test/unit/**/*.test.js', { read: false })
            .pipe(mocha({
                ui: 'bdd',
                reporter: 'spec'
            }));
});

/*****
 * Coverage task, runs mocha tests and covers the lib files.
 *****/
gulp.task('cover', function () {
    return gulp.src('./test/unit/**/*.test.js', { read: false })
            .pipe(cover.instrument({
                pattern: ['./lib/*.js']
            }))
            .pipe(mocha({
                ui: 'bdd',
                reporter: 'spec',
                timeout: 30000
            }))
            .pipe(cover.gather())
            .pipe(cover.format())
            .pipe(gulp.dest('./.coverdata'));
});

/*****
 * Default task, runs jshint and test tasks.
 *****/
gulp.task('default', ['jshint', 'test']);
