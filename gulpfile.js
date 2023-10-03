import gulp from "gulp";
//SERVER
import browserSync from "browser-sync";
//UTILS
import rename from "gulp-rename";
// import del from 'del';
import { deleteSync } from "del";
import notify from "gulp-notify";
//HTML
import htmlmin from "gulp-htmlmin";
import { htmlValidator } from "gulp-w3c-html-validator";
import bemlinter from "gulp-html-bemlinter";
//STYLES
import plumber from "gulp-plumber";
import sourcemap from "gulp-sourcemaps";
import postcss from "gulp-postcss";
import csso from "postcss-csso";
import dartSass from "sass";
import gulpSass from "gulp-sass";
const sass = gulpSass(dartSass);
import autoprefixer from "autoprefixer";
//JAVASCRIPT
import webpackStream from "webpack-stream";
//OPTIMIZE UTILS
import sitemap from "gulp-sitemap";

const { src, dest, series, watch, parallel } = gulp;

// paths
const srcFolder = "./src";
const buildFolder = "./app";
const paths = {
	srcStyles: `${srcFolder}/styles/index.scss`,
	srcSvg: `${srcFolder}/img/svg/**.svg`,
	srcImgFolder: `${srcFolder}/images`,
	srcFullJs: `${srcFolder}/scripts/**/*.js`,
	srcMainJs: `${srcFolder}/scripts/index.js`,
	srcFontsFolder: `${srcFolder}/fonts`,
	buildJsFolder: `${buildFolder}/scripts`,
	buildCssFolder: `${buildFolder}/styles`,
	buildImgFolder: `${buildFolder}/images`,
};

let isProd = false; // dev by default

browserSync.create();

// Styles
export const styles = () => {
	return src(paths.srcStyles)
		.pipe(
			plumber(
				notify.onError({
					title: "SCSS",
					message: "Error: <%= error.message %>",
				})
			)
		)
		.pipe(sourcemap.init())
		.pipe(sass())
		.pipe(
			postcss([
				autoprefixer({
					cascade: false,
					grid: true,
					overrideBrowserslist: ["last 20 versions"],
				}),
				csso(), //minify css
			])
		)
		.pipe(rename("style.min.css"))
		.pipe(sourcemap.write("."))
		.pipe(dest(paths.buildCssFolder))
		.pipe(browserSync.stream());
};

//HTML
export const html = () => {
	return src([`${srcFolder}/**/*.html`])
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(dest(buildFolder))
		.pipe(gulp.dest("./app"))
		.pipe(browserSync.stream());
};

const siteAddress = "https://www.example.com/";
export const htmlBuild = () => {
	return src([`${srcFolder}/**/*.html`])
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(dest(buildFolder))
		.pipe(
			sitemap({
				siteUrl: siteAddress,
				changefreq: "monthly",
				priority: function (siteUrl, loc, entry) {
					const prior = () => {
						if (loc.toString() === siteAddress) {
							return 1;
						} else if (loc.split(siteAddress).length > 0) {
							return 0.9;
						}
					};
					return prior();
				},
			})
		)
		.pipe(gulp.dest("./app"))
		.pipe(browserSync.stream());
};

//html tests
export const validateMarkup = () => {
	return src(`${srcFolder}/**/*.html`)
		.pipe(htmlValidator.analyzer())
		.pipe(htmlValidator.reporter({ throwErrors: true }));
};

export const lintBemMarkup = () => {
	return src(`${srcFolder}/**/*.html`).pipe(bemlinter());
};

// SCRIPTS
const scripts = () => {
	return src(paths.srcMainJs)
		.pipe(
			plumber(
				notify.onError({
					title: "JS",
					message: "Error: <%= error.message %>",
				})
			)
		)
		.pipe(
			webpackStream({
				mode: isProd ? "production" : "development",
				output: {
					filename: "bundle.js",
				},
				watch: false,
				devtool: "source-map",
				module: {
					rules: [
						{
							test: /\.m?js$/,
							exclude: /(node_modules|bower_components)/,
							use: {
								loader: "babel-loader",
								options: {
									presets: [
										[
											"@babel/preset-env",
											{
												targets: "> 0.25%, not dead",
												debug: true,
												corejs: 3,
												useBuiltIns: "usage",
											},
										],
									],
								},
							},
						},
					],
				},
			})
		)
		.on("error", function (err) {
			console.error("WEBPACK ERROR", err);
			this.emit("end");
		})
		.pipe(dest(paths.buildJsFolder))
		.pipe(browserSync.stream());
};

//IMAGES
//copyimg
export const copyImages = () => {
	return src(`${paths.srcImgFolder}/**/*.{png,jpg,svg,webp}`).pipe(
		dest(`${paths.buildImgFolder}`)
	);
};

// Copy
export const copy = (done) => {
	src(
		[
			`${paths.srcFontsFolder}/*.{woff2,woff}`,
			`${srcFolder}/*.ico`,
			`${srcFolder}/manifest.webmanifest`,
		],
		{
			base: srcFolder,
		}
	).pipe(dest(buildFolder));
	done();
};

//Clean
export const clean = async () => {
	return await deleteSync([buildFolder]);
};

//SERVER
export function startServer(done) {
	browserSync.init({
		server: {
			baseDir: [buildFolder],
		},
		cors: true,
		notify: false,
		ui: false,
	});
	done();
}

const reloadServer = (done) => {
	browserSync.reload();
	done();
};

const watchFiles = () => {
	watch([`${srcFolder}/styles/**/*.scss`], series(styles));
	watch(`${srcFolder}/*.html`, series(html, reloadServer));
	watch(`${srcFolder}/scripts/**/*.js`, series(scripts));
};

const toProd = (done) => {
	isProd = true;
	done();
};

//SCRIPTS build and developer server
export function runBuild(done) {
	series(toProd, clean)(done);
	parallel(htmlBuild, styles, scripts, copyImages, copy)(done);
}

export function runDev(done) {
	series(clean, copyImages, copy, html, styles, scripts)(done);
	series(startServer, watchFiles)(done);
}
