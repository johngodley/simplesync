#! /usr/bin/env node
/**
 * Simple Sync
 *
 * Expects your local directory to match the remote. If you enter a subdirectory and run 'changer down' it will sync that subdirectory
 */
const path = require( 'path' );
const chokidar = require( 'chokidar' );
const { exec } = require('child_process');
const rc = require( 'rc' );

const config = rc( 'simplesync', {
	local: false,   // Local directory
	remote: false,  // Remote SSH directory that the local is mapped to

	scp: '',        // Extra scp args
	rsync: '',      // Extra rsync args

	test: false,    // If enabled then commands aren't run
	verbose: true,  // Output commands
} );

const getRemote = target => target.split( ':' ).length === 2 ? target.split( ':' )[ 1 ] : false;
const getLocalFile = file => file.replace( path.resolve( config.local ), '' );
const getRemotePath = () => path.resolve( path.join( getRemote( config.remote ), process.cwd().replace( config.local, '' ) ) ) + '/'
const getCmd = args => args.filter( item => item ).join( ' ' );
const getExclude = exclude => exclude.map( item => '"--exclude=' + item + '"' ).join( ' ' );

if ( ! config.local || ! config.remote ) {
	console.error( "simplesync: [--local=dir] [--remote=ssh] {--test} [up|down]" );
	console.error( "  --local=dir - Local directory that is the 'base' to sync from" );
	console.error( "  --remote=ssh - Remote SSH URL containing username, server, and target directory" );
	console.error( "  --test - Run in test mode, outputting what will change but not doing anything" );
	console.error( "  --verbose - Output every action (enabled when --test is enabled)" );
	console.error( '' );
	console.error( '  up - Sync local to remote and quit' );
	console.error( '  down - Sync remote to local and quit' );
	console.error( '' );
	console.error( 'Will look for .simplesyncrc in current and parent directories - a JSON file containing local and remote' );

	process.exit( 1 );
}

if ( config.test ) {
	console.log( '[Test mode enabled]\n' );
	config.verbose = true;
}

if ( process.argv.indexOf( 'up' ) !== -1 ) {
	syncUp();
	return;
} else if ( process.argv.indexOf( 'down' ) !== -1 ) {
	syncDown();
	return;
} else {
	console.log( 'Monitoring ' + config.local + ' and syncing with ' + config.remote );
}

const watcher = chokidar.watch( './', {
	ignored: /(^|[\/\\])\../,
	ignoreInitial: true,
} );

watcher.on( 'add', path => {
	syncFile( path );
} );

watcher.on( 'unlink', path => {
	removeFile( path );
} );

watcher.on( 'change', path => {
	console.log( 'change' );
	syncFile( path );
} );

watcher.on( 'addDir', path => {
	syncDir( path );
} );

watcher.on( 'unlinkDir', path => {
	removeFile( path );
} );

function syncUp() {
	const local = getLocalFile( path.resolve( process.cwd() ) );
	const cmd = getCmd( [
		'rsync',
		'-rdvC',
		'--exclude=node_modules',
		config.rsync,
		config.test ? '--dry-run' : false,
		'--delete',
		config.local,
		path.join( config.remote, local ).replace( /\/$/, '' ) + '/',
	] );

	if ( config.verbose ) {
		console.log( 'Sync local => remote: ' + cmd + '\n' );
	}

	runCmd( cmd, 'Failed to sync up', () => {
		process.exit( 1 );
	} );
}

function syncDown() {
	const local = getLocalFile( path.resolve( process.cwd() ) );
	const cmd = getCmd( [
		'rsync',
		'-rdCt',
		'--exclude=node_modules',
		'--exclude=.simplesyncrc',
		'--exclude=.git',
		config.exclude ? getExclude( config.exclude ) : false,
		config.rsync,
		config.test ? '--dry-run -v' : false,
		'--delete',
		path.join( config.remote, local ).replace( /\/$/, '' ) + '/',
		path.join( config.local, local ).replace( /\/$/, '' ) + '/',
	] );

	if ( config.verbose ) {
		console.log( 'Sync remote => local: ' + cmd + '\n' );
	}

	runCmd( cmd, 'Failed to sync down', () => {
		process.exit( 1 );
	} );
}

function copyToRemote( file, args ) {
	console.log( 'copy' );
	const local = getLocalFile( path.resolve( path.join( process.cwd(), file ) ) );
	const cmd = getCmd( [
		'scp',
		args,
		path.resolve( path.join( process.cwd(), file ) ),
		path.join( config.remote, local ),
	] );

	if ( config.verbose ) {
		console.log( 'Update: ' + cmd );
	}

	if ( ! config.test ) {
		runCmd( cmd, 'Failed to copy: ' + file );
	}
}

function removeFile( file ) {
	const local = getLocalFile( path.resolve( path.join( process.cwd(), file ) ) );

	const cmd = getCmd( [
		'rsync',
		'-rd',
		config.rsync,
		config.test ? '--dry-run -v' : false,
		'--delete',
		'--include=' + path.basename( file ),
		'"--exclude=*"',
		path.resolve( path.join( process.cwd(), local, '..' ) ) + '/',
		path.join( config.remote, path.basename( process.cwd() ), path.dirname( file ) ) + '/',
	] );

	if ( config.verbose ) {
		console.log( 'Remove: ' + cmd );
	}

	runCmd( cmd, 'Failed to remove: ' + file );
}

function syncDir( file ) {
	copyToRemote( file, '-r ' + config.scp );
}

function syncFile( file ) {
	copyToRemote( file, config.scp );
}

function printRsync( text ) {
	const lines = text.split( '\n' );
	let print = false;

	for ( let index = 0; index < lines.length; index++ ) {
		if ( lines[index] === 'building file list ... done' || lines[index] === 'receiving file list ... done' ) {
			print = true;
			continue;
		} else if ( lines[index] === '' ) {
			print = false;
		}

		if ( print ) {
			if ( lines[index].substr( 0, 8 ) === 'deleting' ) {
				console.log( '- ' + lines[index].substr( 9 ) );
			} else if ( lines[index].substr( 0, 8 ) === 'skipping' ) {
				console.log( '@ ' + lines[index].substr( 9 ) );
			} else {
				console.log( '+ ' + lines[index] );
			}
		}
	}
}

function runCmd( cmd, failMessage, cb ) {
	exec( cmd, { maxBuffer: 1024 * 1500 }, function( error, stdout, stderr ) {
		if ( error ) {
			console.error( failMessage, error );
		}

		if ( config.test ) {
			printRsync( stdout );
		}

		cb && cb();
	} );
}
