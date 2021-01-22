import Head from 'next/head';
import airtable from "airtable";
import {useEffect, useState} from "react";
import {format} from "date-fns";

export default function Home(props) {
    const [games, setGames] = useState(initializeGames());
    const [playerElos, setPlayerElos] = useState(initializePlayerElos());

    function initializeGames() {
        return props.games
            .sort((a, b) => +new Date(a["Date"]) - +new Date(b["Date"]))
            .map(game => ({...game, player1elo: 1000, player2elo: 1000}));
    }

    function initializePlayerElos() {
        // all unique player names
        const allPlayers = [...games.map(d => d["Player 1"]), ...games.map(d => d["Player 2"])]
            .filter((d, i, a) => a.indexOf(d) === i);

        // initialize dictionary with each player at rating 1000
        return Object.fromEntries(allPlayers.map(d => [d, {elo: 1000, wins: 0, losses: 0}]));
    }

    useEffect(() => {
        // duplicate state vars for update
        let newPlayerElos = initializePlayerElos();
        let newGames = initializeGames();

        // maximum amount rating can be changed per game
        const maxChange = 30;

        console.log(newPlayerElos, newGames);

        for (let gameIndex in newGames) {
            const game = newGames[gameIndex];
            const winner = game["Win"] === game["Player 1"] ? "Player 1" : "Player 2";
            const loser = game["Win"] === game["Player 1"] ? "Player 2" : "Player 1";
            newPlayerElos[game[winner]].wins++;
            newPlayerElos[game[loser]].losses++;
            const rating1 = newPlayerElos[game["Player 1"]].elo;
            const rating2 = newPlayerElos[game["Player 2"]].elo;
            newGames[gameIndex].player1elo = rating1;
            newGames[gameIndex].player2elo = rating2;
            const expected1 = 1 / (1 + 10 ** ((rating2 - rating1) / 400));
            const expected2 = 1 / (1 + 10 ** ((rating1 - rating2) / 400));
            const score1 = +(game["Win"] === game["Player 1"]);
            const score2 = +(game["Win"] === game["Player 2"]);
            const newRating1 = rating1 + maxChange * (score1 - expected1);
            const newRating2 = rating2 + maxChange * (score2 - expected2);
            newPlayerElos[game["Player 1"]].elo = newRating1;
            newPlayerElos[game["Player 2"]].elo = newRating2;
        }

        setPlayerElos(newPlayerElos);
        setGames(newGames);
    }, []);

    return (
        <>
            <Head>
                <title>Edyfi ping pong Elo tracker</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css"/>
            </Head>
            <h1>Edyfi ping pong elo tracker</h1>
            <p>Log new games through <a href="https://airtable.com/shrl6FUmJspGANrPK">+AirTable form</a>. Made by <a
                href="https://twitter.com/wwsalmon"
            >Samson Zhang</a></p>
            <hr/>
            <h2>Player stats</h2>
            <table>
                <thead>
                <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Elo</th>
                    <th>Wins</th>
                    <th>Losses</th>
                </tr>
                </thead>
                <tbody>
                {Object.entries(playerElos)
                    .sort((a, b) => b[1].elo - a[1].elo)
                    .map((player, i) => (
                        <tr>
                            <td>{i + 1}</td>
                            <td>{player[0]}</td>
                            <td>{Math.floor(player[1].elo)}</td>
                            <td>{player[1].wins}</td>
                            <td>{player[1].losses}</td>
                        </tr>
                    ))
                }
                </tbody>
            </table>
            <hr/>
            <h2>Past games</h2>
            <table>
                <thead>
                <tr>
                    <th>Date</th>
                    <th>Player 1</th>
                    <th>Score 1</th>
                    <th>Player 2</th>
                    <th>Score 2</th>
                </tr>
                </thead>
                <tbody>
                {function () {
                    return games.slice(0).reverse().map(game => (
                        <tr>
                            <td>{format(new Date(game.Date), "M/d 'at' h:mm aa")}</td>
                            <td style={{fontWeight: game["Win"] === game["Player 1"] ? 700 : 400}}>
                                {game["Player 1"]} ({Math.floor(game.player1elo)})
                            </td>
                            <td>{game["Player 1 score"]}</td>
                            <td style={{fontWeight: game["Win"] === game["Player 2"] ? 700 : 400}}>
                                {game["Player 2"]} ({Math.floor(game.player2elo)})
                            </td>
                            <td>{game["Player 2 score"]}</td>
                        </tr>
                    ));
                }()}
                </tbody>
            </table>
        </>
    );
}

export async function getServerSideProps(ctx) {
    const base = airtable.base("appJW8IinnjFjPllg");
    const games = await base("Games").select().all();
    const gamesFields = games.map(d => d.fields);
    return {props: {games: JSON.parse(JSON.stringify(gamesFields))}};
}