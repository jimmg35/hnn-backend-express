import { BaseController, EndpointMethodMapping } from "../BaseController"
import { Request, Response } from 'express'
import { PostgreSQLContext } from "../../lib/dbcontext"
import { autoInjectable, inject } from "tsyringe"
import StatusCodes from 'http-status-codes'
import sha256 from "sha256"
import { Apr } from "../../entity/apr/apr.entity.exclude"

const { OK } = StatusCodes

@autoInjectable()
export default class AprController extends BaseController {


  public dbcontext: PostgreSQLContext
  public endpointMethod: EndpointMethodMapping = {
    "query": "POST",
    "listByExtent": "GET",
    "getById": "GET"
  }

  constructor(
    @inject('dbcontext') dbcontext: PostgreSQLContext
  ) {
    super()
    this.dbcontext = dbcontext
  }

  public listByExtent = async (req: Request, res: Response) => {
    const { xmin, xmax, ymin, ymax } = { ...req.query } as unknown as { xmin: number; xmax: number; ymin: number; ymax: number }

    const repo = this.dbcontext.connection.getRepository(Apr)
    const result = await repo
      .query(`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(feature)
        ) AS result
        FROM (
            SELECT json_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(coordinate)::json,
                'properties', json_build_object(
                    'id', id
                )
            ) AS feature
            FROM apr
            WHERE coordinate && ST_MakeEnvelope(119, 20, 122, 25, 4326)
        ) AS features;
      `)
    return res.status(OK).json(result[0]['result'])
  }

  public query = async (req: Request, res: Response) => {
    const { geojson, transactionTimeStart, transactionTimeEnd } = { ...req.body } as unknown as {
      geojson: string; transactionTimeStart: string; transactionTimeEnd: string
    }

    const repo = this.dbcontext.connection.getRepository(Apr)
    const result = await repo
      .query(`
        SELECT id, unitprice,
        ST_AsGeoJSON(coordinate)::json AS geometry
        FROM apr
        WHERE ST_Intersects(coordinate, ST_GeomFromGeoJSON('${geojson}'))
        AND transactiontime >= '${transactionTimeStart}'
        AND transactiontime <= '${transactionTimeEnd}';
      `)

    return res.status(OK).json(result)
  }

  public getById = async (req: Request, res: Response) => {
    const { id } = { ...req.query } as unknown as { id: string }

    const repo = this.dbcontext.connection.getRepository(Apr)
    const aprs = await repo.findOne({
      where: { id: id }
    })

    if (!aprs) return res.status(404).json({ status: 'not found' })

    return res.status(OK).json(aprs)
  }

}
