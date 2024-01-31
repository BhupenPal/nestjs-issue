import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { SearchProducts } from './dto/search-products.dto';

@Injectable()
export class CoreService {
  constructor(private readonly httpService: HttpService) {}

  async getProducts({
    searchQuery,
    host,
    pageNo = 1,
  }: {
    searchQuery: string;
    host: string;
    pageNo: number;
  }) {
    try {
      const products = await this.httpService.axiosRef.get<SearchProducts>(
        `${host}?text=${searchQuery}&aggregation=false&size=50&page=${pageNo}`,
        {
          headers: {
            ondc_application: 'TEST',
          },
        },
      );

      return {
        data: products.data.products,
        total: products.data.total,
        pageNo: products.data.page,
        size: products.data.size,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('AXIOS ERROR: ', error.response);
      }

      throw new InternalServerErrorException();
    }
  }
}
